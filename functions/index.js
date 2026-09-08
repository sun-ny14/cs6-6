'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onValueWritten } = require('firebase-functions/v2/database');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

initializeApp();

const REGION = 'asia-northeast3';
const TEACHER_EMAIL = 'ksosuny@cberi.go.kr';
const callable = handler => onCall({ region: REGION, enforceAppCheck: false }, handler);
const cleanEmail = value => String(value || '').trim().toLowerCase();
const safeKey = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
const kstDate = timestamp => new Date(timestamp + 9 * 3600000).toISOString().slice(0, 10);
const publicUser = (name, user={}) => ({
    name:String(user.name || name), no:Number(user.no || user.number || 0),
    character:String(user.character || ''), selectedAnimal:String(user.selectedAnimal || ''),
    selectedTitle:String(user.selectedTitle || ''), myRoom:user.myRoom || null
});
const publicSettings = settings => ({
    lateTime:String(settings?.lateTime || '08:40'), closeTime:String(settings?.closeTime || '09:00'),
    routineText:String(settings?.routineText || ''), giftList:Array.isArray(settings?.giftList) ? settings.giftList : [],
    housingEnabled:settings?.housingEnabled !== false, defaultBg:String(settings?.defaultBg || '')
});
const cleaningSettings = settings => ({
    studentRoles:settings?.studentRoles || {}, cleaningAssignments:settings?.cleaningAssignments || {}
});

function requireAuth(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    return request.auth;
}

async function actor(request) {
    const auth = requireAuth(request);
    const email = cleanEmail(auth.token.email);
    const teacher = email === TEACHER_EMAIL;
    if (teacher) return { uid:auth.uid, email, name:'총사령관', role:'교사', teacher:true };
    const emailKey = email.replace(/\./g, ',');
    const name = String((await getDatabase().ref(`userEmails/${emailKey}`).get()).val() || '').trim();
    if (!name) throw new HttpsError('permission-denied', '등록된 학생 계정이 아닙니다.');
    const userSnapshot = await getDatabase().ref(`users/${name}`).get();
    if (!userSnapshot.exists()) throw new HttpsError('permission-denied', '등록된 학생 정보를 찾을 수 없습니다.');
    // userEmails is teacher-managed and is the authoritative login mapping.
    // Older student records may contain "미등록" or a stale email value, so requiring
    // the duplicated users/{name}/email field to match would lock out valid students.
    const user = userSnapshot.val() || {};
    return { uid:auth.uid, email, name, role:String(user.role || '').trim(), teacher:false, user };
}

exports.getSecureSession = callable(async request => {
    const current = await actor(request);
    const database = getDatabase();
    const updates = {};
    updates[`access/${current.uid}`] = {
        name:current.name, role:current.role, teacher:current.teacher, updatedAt:Date.now()
    };
    const settings = (await database.ref('settings').get()).val() || {};
    updates.publicSettings = publicSettings(settings);
    updates.cleaningSettings = cleaningSettings(settings);
    if (current.teacher) {
        const users = (await database.ref('users').get()).val() || {};
        Object.entries(users).forEach(([name,user]) => { updates[`publicProfiles/${name}`] = publicUser(name,user); });
    } else {
        updates[`publicProfiles/${current.name}`] = publicUser(current.name,current.user);
    }
    const orders=(await database.ref('orders').get()).val()||{};
    Object.entries(orders).forEach(([key,order])=>{
        if(current.teacher||order?.user===current.name)updates[`ordersByUser/${order.user}/${key}`]=order;
    });
    await database.ref().update(updates);
    return { name:current.name, role:current.role, teacher:current.teacher,
        user:current.teacher ? { name:current.name, role:'교사' } : current.user };
});

exports.mirrorPublicUser = onValueWritten({ ref:'/users/{userName}' }, async event => {
    const name = event.params.userName;
    const user = event.data.after.val();
    const database=getDatabase();
    const updates={[`publicProfiles/${name}`]:user ? publicUser(name,user) : null};
    const access=await database.ref('access').orderByChild('name').equalTo(name).get();
    access.forEach(child=>{updates[`access/${child.key}/role`]=String(user?.role||'');});
    await database.ref().update(updates);
});

exports.mirrorPublicSettings = onValueWritten({ ref:'/settings' }, async event => {
    const settings = event.data.after.val();
    await getDatabase().ref().update({
        publicSettings:settings ? publicSettings(settings) : null,
        cleaningSettings:settings ? cleaningSettings(settings) : null
    });
});

exports.mirrorOrder = onValueWritten({ ref:'/orders/{orderId}' }, async event => {
    const before=event.data.before.val(), after=event.data.after.val(), id=event.params.orderId;
    const updates={};
    if(before?.user)updates[`ordersByUser/${before.user}/${id}`]=null;
    if(after?.user)updates[`ordersByUser/${after.user}/${id}`]=after;
    if(Object.keys(updates).length)await getDatabase().ref().update(updates);
});

exports.purchasePointShop = callable(async request => {
    const current = await actor(request);
    if (current.teacher) throw new HttpsError('failed-precondition', '학생 계정에서 구매해 주세요.');
    const itemKey = request.data?.itemKey;
    if (!safeKey(itemKey)) throw new HttpsError('invalid-argument', '상품 정보가 올바르지 않습니다.');
    const database = getDatabase();
    const orderKey = database.ref('orders').push().key;
    const logKey = database.ref('pointLogs').push().key;
    const historyKey = database.ref(`pointHistory/${current.name}`).push().key;
    let reason = '';
    const result = await database.ref().transaction(root => {
        if (!root) return;
        const item = root.shop?.[itemKey];
        const user = root.users?.[current.name];
        if (!item || !user) { reason='missing'; return; }
        const price = Number(item.price), limit = Math.max(0, Number(item.limit) || 0);
        const stock = item.stock == null ? -1 : Number(item.stock);
        const points = Number(user.points) || 0;
        if (!Number.isSafeInteger(price) || price < 0) { reason='invalid-price'; return; }
        if (item.isSoldOut === true || (stock !== -1 && stock <= 0)) { reason='sold-out'; return; }
        if (points < 0 || points < price) { reason='points'; return; }
        const bought = Object.values(root.orders || {}).filter(order => order?.user === current.name &&
            order?.shopKey === itemKey && order?.limitReset !== true).length;
        if (limit > 0 && bought >= limit) { reason='limit'; return; }
        const now = Date.now(), next = points - price;
        root.users[current.name].points = next;
        if (stock > 0) root.shop[itemKey].stock = stock - 1;
        root.orders ||= {};
        root.orders[orderKey] = { user:current.name, shopKey:itemKey, item:String(item.name || ''),
            price, time:now, status:'요청' };
        root.ordersByUser ||= {}; root.ordersByUser[current.name] ||= {};
        root.ordersByUser[current.name][orderKey]=root.orders[orderKey];
        root.pointLogs ||= {};
        root.pointLogs[logKey] = { name:current.name, pAmt:-price,
            reason:`[상점 구매] ${String(item.name || '')}`, timestamp:now };
        root.pointHistory ||= {}; root.pointHistory[current.name] ||= {};
        root.pointHistory[current.name][historyKey] = { date:kstDate(now), reason:`[상점 구매] ${String(item.name || '')}`,
            change:-price, pChange:-price, expChange:0, result:next, pointResult:next, timestamp:now };
        return root;
    }, undefined, false);
    if (!result.committed) {
        const messages = { missing:'상품 또는 사용자 정보를 찾을 수 없습니다.', 'invalid-price':'상품 가격이 올바르지 않습니다.',
            'sold-out':'품절된 상품입니다.', points:'포인트가 부족합니다.', limit:'구매 한도를 초과했습니다.' };
        throw new HttpsError('failed-precondition', messages[reason] || '구매를 완료하지 못했습니다.');
    }
    const saved = result.snapshot.val();
    return { orderKey, name:saved.orders[orderKey].item, price:saved.orders[orderKey].price,
        points:saved.users[current.name].points };
});

const BUILTIN_FURNITURE = {
    'builtin-bed':{name:'포근한 침대',category:'가구',img:'assets/housing/furniture/bed.png',price:8},
    'builtin-bookshelf':{name:'용사의 책장',category:'가구',img:'assets/housing/furniture/bookshelf.png',price:6},
    'builtin-chair':{name:'나무 의자',category:'가구',img:'assets/housing/furniture/chair.png',price:3},
    'builtin-clock':{name:'벽시계',category:'가구',img:'assets/housing/furniture/clock.png',price:4},
    'builtin-desk':{name:'공부 책상',category:'가구',img:'assets/housing/furniture/desk.png',price:7},
    'builtin-lamp':{name:'스탠드 조명',category:'가구',img:'assets/housing/furniture/lamp.png',price:4},
    'builtin-picture':{name:'모험 그림',category:'가구',img:'assets/housing/furniture/picture.png',price:4},
    'builtin-plant':{name:'초록 화분',category:'가구',img:'assets/housing/furniture/plant.png',price:3},
    'builtin-rug':{name:'포근한 러그',category:'가구',img:'assets/housing/furniture/rug.png',price:5},
    'builtin-toy-box':{name:'장난감 상자',category:'가구',img:'assets/housing/furniture/toy-box.png',price:5},
    'builtin-forest-sofa':{name:'숲속 독서 소파',category:'가구',img:'assets/housing/furniture/forest-sofa.png',price:6,requiredLevel:3},
    'builtin-potion-table':{name:'마법 물약 테이블',category:'가구',img:'assets/housing/furniture/potion-table.png',price:8,requiredLevel:5},
    'builtin-knight-stand':{name:'기사단 방패 장식',category:'가구',img:'assets/housing/furniture/knight-stand.png',price:10,requiredLevel:8},
    'builtin-star-telescope':{name:'별빛 망원경',category:'가구',img:'assets/housing/furniture/star-telescope.png',price:12,requiredLevel:12},
    'builtin-royal-chair':{name:'왕실 벨벳 의자',category:'가구',img:'assets/housing/furniture/royal-chair.png',price:15,requiredLevel:16},
    'builtin-sky-aquarium':{name:'구름섬 수족관',category:'가구',img:'assets/housing/furniture/sky-aquarium.png',price:18,requiredLevel:20}
};

exports.purchaseHousingItem = callable(async request => {
    const current = await actor(request);
    const itemKey = request.data?.itemKey, purchaseId = request.data?.purchaseId;
    if (!safeKey(itemKey) || !safeKey(purchaseId)) throw new HttpsError('invalid-argument', '구매 정보가 올바르지 않습니다.');
    const database = getDatabase();
    const remote = BUILTIN_FURNITURE[itemKey] ? null : (await database.ref(`housingShop/${itemKey}`).get()).val();
    const item = BUILTIN_FURNITURE[itemKey] || remote;
    if (!item || String(item.category || item.cat || '').includes('배경')) throw new HttpsError('not-found', '구매할 수 없는 아이템입니다.');
    const price = Number(item.price), requiredLevel = Math.max(1, Number(item.requiredLevel) || 1);
    if (!Number.isSafeInteger(price) || price < 0) throw new HttpsError('failed-precondition', '아이템 가격이 올바르지 않습니다.');
    let reason = '';
    const result = await database.ref(`users/${current.name}`).transaction(user => {
        if (!user && !current.teacher) { reason='missing'; return; }
        user ||= { name:current.name, roomCoins:0 };
        if (user.housingPurchases?.[purchaseId]) return user;
        const level = Math.max(1, Number(user.level || user.lv) || 1);
        if (!current.teacher && level < requiredLevel) { reason='level'; return; }
        const charge = current.teacher ? 0 : price;
        const coins = Number(user.roomCoins);
        if (!current.teacher && (!Number.isFinite(coins) || coins < charge)) { reason='coins'; return; }
        user.roomCoins = current.teacher ? (Number.isFinite(coins) ? coins : 0) : coins - charge;
        user.housingInventory ||= {}; user.housingPurchases ||= {};
        user.housingInventory[purchaseId] = { shopKey:itemKey, name:String(item.name || ''),
            category:String(item.category || item.cat || '가구'), img:String(item.img || item.url || ''), purchasedAt:Date.now() };
        user.housingPurchases[purchaseId] = { itemKey, name:String(item.name || ''), price:charge,
            listPrice:price, teacherFree:current.teacher, currency:'C', balanceAfter:user.roomCoins,
            inventoryKey:purchaseId, timestamp:Date.now() };
        return user;
    }, undefined, false);
    if (!result.committed) {
        const messages={missing:'학생 정보를 찾을 수 없습니다.',level:`Lv.${requiredLevel}부터 구매할 수 있습니다.`,coins:'방꾸미기 코인이 부족합니다.'};
        throw new HttpsError('failed-precondition', messages[reason] || '구매를 완료하지 못했습니다.');
    }
    const user=result.snapshot.val();
    return { receipt:user.housingPurchases[purchaseId], roomCoins:user.roomCoins };
});

exports.verifyCheckinPassword = callable(async request => {
    await actor(request);
    const password = String(request.data?.password || '');
    if (!/^\d{4}$/.test(password)) throw new HttpsError('invalid-argument', '암호는 숫자 4자리여야 합니다.');
    const settings = (await getDatabase().ref('settings').get()).val() || {};
    if (String(settings.password || '') !== password) throw new HttpsError('permission-denied', '등교 암호가 맞지 않습니다.');
    return { valid:true, lateTime:String(settings.lateTime || '08:40'), closeTime:String(settings.closeTime || '09:00') };
});

exports.submitStudentCheckin = callable(async request => {
    const current=await actor(request);
    if(current.teacher)throw new HttpsError('failed-precondition','학생 계정에서 등교해 주세요.');
    const password=String(request.data?.password||'');
    if(!/^\d{4}$/.test(password))throw new HttpsError('invalid-argument','암호는 숫자 4자리여야 합니다.');
    const database=getDatabase(), now=Date.now(), date=kstDate(now);
    const clock=new Date(now+9*3600000);
    const currentMinutes=clock.getUTCHours()*60+clock.getUTCMinutes();
    const toMinutes=(value,fallback)=>{
        const match=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));
        return match?Number(match[1])*60+Number(match[2]):fallback;
    };
    const recordKey=database.ref('checkins').push().key;
    const logKey=database.ref('pointLogs').push().key;
    const historyKey=database.ref(`pointHistory/${current.name}`).push().key;
    let outcome={};
    const result=await database.ref().transaction(root=>{
        if(!root?.settings||!root?.users?.[current.name])return;
        if(String(root.settings.password||'')!==password){outcome={error:'password'};return;}
        const close=toMinutes(root.settings.closeTime,9*60);
        if(currentMinutes>close){outcome={error:'closed',closeTime:String(root.settings.closeTime||'09:00')};return;}
        const late=Math.max(0,currentMinutes-toMinutes(root.settings.lateTime,8*60+40));
        const weekDays=['일','월','화','수','목','금','토'];
        const excluded=Array.isArray(root.settings.fixedExclusions?.[weekDays[clock.getUTCDay()]])&&
            root.settings.fixedExclusions[weekDays[clock.getUTCDay()]].includes(current.name);
        const desired=excluded?0:-Math.min(9,late);
        root.checkins||={};
        const existingEntry=Object.entries(root.checkins).find(([,value])=>
            String(value?.name||value?.user||'')===current.name&&String(value?.date||'')===date);
        const key=existingEntry?.[0]||recordKey;
        const existing=existingEntry?.[1]||{};
        const previous=Number(existing.pointPenalty)||0;
        const delta=desired-previous;
        const category=late>0?'지각':'정상';
        root.checkins[key]={...existing,name:current.name,user:current.name,date,
            category,reason:`${category} 등교`,result:`${category} 등교`,source:'qr',
            time:`${String(clock.getUTCHours()).padStart(2,'0')}:${String(clock.getUTCMinutes()).padStart(2,'0')}`,
            timestamp:now,pointPenalty:desired,penaltySource:late>0?'qr':'none',lateMinutes:late};
        root.blackboardDisplay||={}; root.blackboardDisplay.data||={};
        root.blackboardDisplay.data.checkins||={};
        root.blackboardDisplay.data.checkins[key]={name:current.name,date,attended:true};
        const user=root.users[current.name];
        if(delta){
            user.points=(Number(user.points)||0)+delta;
            root.pointLogs||={}; root.pointLogs[logKey]={name:current.name,pAmt:delta,
                reason:delta<0?`지각 등교 자동 차감 (${late}분 지각)`:'출결 수정에 따른 지각 차감 복구',timestamp:now};
            root.pointHistory||={}; root.pointHistory[current.name]||={};
            root.pointHistory[current.name][historyKey]={date,reason:root.pointLogs[logKey].reason,
                change:delta,pChange:delta,expChange:0,result:user.points,pointResult:user.points,timestamp:now};
        }
        user.roomCoins=Number.isFinite(Number(user.roomCoins))?Number(user.roomCoins):10;
        user.roomCoinRewards||={};user.roomCoinRewards.checkin||={};
        const oldReward=user.roomCoinRewards.checkin[date];
        if(category==='정상'&&!oldReward){user.roomCoins+=1;user.roomCoinRewards.checkin[date]={amount:1,grantedAt:now};}
        if(category!=='정상'&&oldReward){user.roomCoins=Math.max(0,user.roomCoins-(Number(oldReward.amount)||1));delete user.roomCoinRewards.checkin[date];}
        outcome={lateBy:late,penalty:desired,points:user.points,roomCoins:user.roomCoins};
        return root;
    },undefined,false);
    if(!result.committed){
        if(outcome.error==='password')throw new HttpsError('permission-denied','등교 암호가 맞지 않습니다.');
        if(outcome.error==='closed')throw new HttpsError('failed-precondition',`등교 확인 시간이 마감되었습니다. (${outcome.closeTime})`);
        throw new HttpsError('failed-precondition','등교 정보를 저장하지 못했습니다.');
    }
    return outcome;
});

exports.addRoomReaction = callable(async request => {
    const current = await actor(request);
    const owner = String(request.data?.owner || '').trim();
    const type = String(request.data?.type || '');
    if (!owner || owner === current.name || !['heart','clap','wow'].includes(type)) {
        throw new HttpsError('invalid-argument', '방 반응 정보가 올바르지 않습니다.');
    }
    const database = getDatabase();
    const day = kstDate(Date.now());
    const entryKey = database.ref(`users/${owner}/myRoom/guestbook`).push().key;
    let duplicate = false;
    const result = await database.ref(`users/${owner}/myRoom`).transaction(room => {
        room ||= {};
        if (room.dailyReactions?.[current.name]?.[day]) { duplicate=true; return; }
        room.dailyReactions ||= {}; room.dailyReactions[current.name] ||= {};
        room.dailyReactions[current.name][day] = type;
        room.guestbook ||= {};
        room.guestbook[entryKey] = { user:current.name, type, day, timestamp:Date.now() };
        room[type] = (Number(room[type]) || 0) + 1;
        return room;
    }, undefined, false);
    if (!result.committed && !duplicate) throw new HttpsError('failed-precondition', '반응을 저장하지 못했습니다.');
    return { committed:result.committed, room:result.snapshot.val() || {} };
});

exports.syncHousingRewards = callable(async request => {
    const current = await actor(request);
    const database = getDatabase();
    const result = await database.ref(`users/${current.name}`).transaction(user => {
        if (!user && !current.teacher) return;
        user ||= { name:current.name };
        const level=Math.max(1,Number(user.level||user.lv)||1);
        const coins=Number(user.roomCoins), rewarded=Number(user.roomRewardedLevel);
        user.roomCoins=Number.isFinite(coins)?coins:10;
        user.roomRewardedLevel=Number.isFinite(rewarded)?rewarded:level;
        if(Number.isFinite(coins)&&Number.isFinite(rewarded)&&level>rewarded){
            user.roomCoins+=(level-rewarded)*5;
            user.roomRewardedLevel=level;
        }
        return user;
    },undefined,false);
    if(!result.committed)throw new HttpsError('not-found','사용자 정보를 찾을 수 없습니다.');
    return result.snapshot.val();
});

exports.setCheckinRoomReward = callable(async request => {
    const current=await actor(request);
    if(current.teacher)throw new HttpsError('failed-precondition','학생 직접 등교 보상 전용 기능입니다.');
    const date=String(request.data?.date||'');
    if(date!==kstDate(Date.now()))throw new HttpsError('invalid-argument','오늘 출석만 반영할 수 있습니다.');
    const database=getDatabase();
    const checkins=(await database.ref('checkins').get()).val()||{};
    const record=Object.values(checkins).find(value=>
        String(value?.name||value?.user||'')===current.name&&String(value?.date||'')===date);
    const normal=String(record?.category||record?.result||'').includes('정상');
    const result=await database.ref(`users/${current.name}`).transaction(user=>{
        if(!user)return;
        user.roomCoins=Number.isFinite(Number(user.roomCoins))?Number(user.roomCoins):10;
        user.roomCoinRewards||={}; user.roomCoinRewards.checkin||={};
        const previous=user.roomCoinRewards.checkin[date];
        if(normal&&!previous){
            user.roomCoins+=1;
            user.roomCoinRewards.checkin[date]={amount:1,grantedAt:Date.now()};
        }else if(!normal&&previous){
            user.roomCoins=Math.max(0,user.roomCoins-(Number(previous.amount)||1));
            delete user.roomCoinRewards.checkin[date];
        }
        return user;
    },undefined,false);
    if(!result.committed)throw new HttpsError('not-found','사용자 정보를 찾을 수 없습니다.');
    return {roomCoins:result.snapshot.val().roomCoins,normal};
});

exports.requestOrderUse = callable(async request => {
    const current=await actor(request);
    if(current.teacher)throw new HttpsError('failed-precondition','학생 주문 전용 기능입니다.');
    const orderKey=request.data?.orderKey;
    if(!safeKey(orderKey))throw new HttpsError('invalid-argument','주문 정보가 올바르지 않습니다.');
    const database=getDatabase();
    const ref=database.ref(`orders/${orderKey}`);
    const order=(await ref.get()).val();
    if(!order||order.user!==current.name)throw new HttpsError('permission-denied','본인의 주문만 사용할 수 있습니다.');
    const target=String(request.data?.resetTarget||'').trim();
    if(target){
        if(!/리셋|초기화/.test(String(order.item||'')))throw new HttpsError('failed-precondition','리셋 상품 주문이 아닙니다.');
        const owned=(await database.ref('orders').get()).val()||{};
        if(!Object.values(owned).some(value=>value?.user===current.name&&String(value?.item||'').replace(' (한도리셋)','')===target)){
            throw new HttpsError('failed-precondition','구매한 적이 없는 상품은 초기화할 수 없습니다.');
        }
        await ref.update({status:'사용요청',item:`${String(order.item||'')} (요청: ${target})`});
    }else{
        await ref.update({status:'사용요청'});
    }
    return {ok:true};
});

exports.manageShopOrder = callable(async request => {
    const current=await actor(request);
    if(!current.teacher&&current.role!=='상점')throw new HttpsError('permission-denied','상점 역할만 주문을 처리할 수 있습니다.');
    const orderKey=request.data?.orderKey, action=String(request.data?.action||'');
    if(!safeKey(orderKey)||!['approve','reject'].includes(action))throw new HttpsError('invalid-argument','주문 처리 정보가 올바르지 않습니다.');
    const database=getDatabase();
    let missing=false;
    const logKey=database.ref('pointLogs').push().key;
    const result=await database.ref().transaction(root=>{
        const order=root?.orders?.[orderKey];
        if(!order){missing=true;return;}
        if(action==='approve'){
            const match=/\(요청:\s*(.+)\)/.exec(String(order.item||''));
            if(match){
                const target=match[1];
                Object.values(root.orders||{}).forEach(past=>{
                    if(past?.user===order.user&&String(past.item||'').replace(' (한도리셋)','')===target){
                        past.item=`${target} (한도리셋)`;past.limitReset=true;
                    }
                });
            }
            order.status='완료';order.processedAt=Date.now();order.processedBy=current.name;
        }else{
            const user=root.users?.[order.user];
            const refund=Math.max(0,Number(order.price)||0);
            if(user&&refund){user.points=(Number(user.points)||0)+refund;root.pointLogs||={};
                root.pointLogs[logKey]={name:order.user,pAmt:refund,reason:`[환불] ${String(order.item||'')} 승인 거절`,timestamp:Date.now()};}
            delete root.orders[orderKey];
        }
        return root;
    },undefined,false);
    if(!result.committed||missing)throw new HttpsError('not-found','주문 정보를 찾을 수 없습니다.');
    return {ok:true};
});
