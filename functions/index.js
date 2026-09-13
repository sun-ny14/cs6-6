'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onValueWritten } = require('firebase-functions/v2/database');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

// 프로젝트에 복구용 RTDB 인스턴스도 있으므로 운영 DB를 명시한다.
// 클라이언트가 보는 상점과 Functions가 조회하는 상점이 항상 같아진다.
initializeApp({databaseURL:'https://cs6-6class-default-rtdb.firebaseio.com'});

const REGION = 'asia-northeast3';
const TEACHER_EMAIL = 'ksosuny@cberi.go.kr';
// 복구된 DB의 큰 학생 레코드도 안정적으로 처리하도록 호출 함수에 여유를 둔다.
const callable = handler => onCall({
    region: REGION,
    memory: '1GiB',
    timeoutSeconds: 60,
    maxInstances: 3,
    enforceAppCheck: false
}, handler);
const cleanEmail = value => String(value || '').trim().toLowerCase();
const safeKey = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
const kstDate = timestamp => new Date(timestamp + 9 * 3600000).toISOString().slice(0, 10);
const scoreLogKey = (requestId,name) =>
    `score_${requestId}_${Buffer.from(String(name)).toString('base64url')}`;
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
    // Login must stay small and deterministic.  Rebuilding every public profile,
    // setting and order here made a restored classroom database exceed the
    // callable container's memory/request limits, causing an HTTP 500 before
    // the CORS response could be returned.
    await database.ref(`access/${current.uid}`).set({
        name:current.name, role:current.role, teacher:current.teacher, updatedAt:Date.now()
    });
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

// 점수 영수증이 만들어지면 두 연대기를 다시 보장한다. 호출 함수가 로그 저장
// 직전에 끊기더라도 이 트리거가 같은 결정적 키로 빠진 기록을 복구한다.
exports.mirrorScoreChangeReceipt = onValueWritten({
    ref:'/users/{userName}/scoreChangeReceipts/{requestId}'
}, async event => {
    const receipt=event.data.after.val();
    if(!receipt)return;
    const userKey=event.params.userName, requestId=event.params.requestId;
    const name=String(receipt.name||userKey);
    const logKey=scoreLogKey(requestId,userKey);
    const timestamp=Number(receipt.timestamp)||Date.now();
    const date=kstDate(timestamp);
    const time=new Date(timestamp+9*3600000).toISOString().slice(11,16);
    const points=Number(receipt.points)||0, exp=Number(receipt.exp)||0;
    const reason=String(receipt.reason||'포인트 변경');
    await getDatabase().ref().update({
        [`pointLogs/${logKey}`]:{name,userKey,pAmt:points,eAmt:exp,reason,time,timestamp},
        [`pointHistory/${userKey}/${logKey}`]:{date,time,reason,change:points,
            pChange:points,expChange:exp,result:Number(receipt.nextPoints)||0,
            pointResult:Number(receipt.nextPoints)||0,expResult:Number(receipt.nextExp)||0,timestamp}
    });
});

exports.mirrorOrder = onValueWritten({ ref:'/orders/{orderId}' }, async event => {
    const before=event.data.before.val(), after=event.data.after.val(), id=event.params.orderId;
    const updates={};
    if(before?.user)updates[`ordersByUser/${before.user}/${id}`]=null;
    if(after?.user)updates[`ordersByUser/${after.user}/${id}`]=after;
    if(Object.keys(updates).length){
        updates['publicShopStats/updatedAt']=0;
        await getDatabase().ref().update(updates);
    }
});

exports.getPopularShopItems = callable(async request => {
    await actor(request);
    const database=getDatabase(), now=Date.now();
    const cacheRef=database.ref('publicShopStats');
    const cached=(await cacheRef.get()).val()||{};
    if(now-Number(cached.updatedAt||0)<300000&&Array.isArray(cached.items)){
        return {items:cached.items};
    }

    const [ordersSnapshot,shopSnapshot]=await Promise.all([
        database.ref('orders').get(),database.ref('shop').get()
    ]);
    const orders=ordersSnapshot.val()||{}, shop=shopSnapshot.val()||{};
    const nameToKey={};
    Object.entries(shop).forEach(([key,item])=>{
        if(item?.name)nameToKey[String(item.name)]=key;
    });
    const counts={};
    Object.values(orders).forEach(order=>{
        const key=String(order?.shopKey||nameToKey[String(order?.item||'')]||'');
        if(key&&shop[key])counts[key]=(counts[key]||0)+1;
    });
    const items=Object.entries(shop)
        .filter(([,item])=>item?.name&&item.isSoldOut!==true&&
            !(item.stock!==-1&&item.stock!=null&&Number(item.stock)<=0))
        .map(([key,item])=>({key,name:String(item.name),cat:String(item.cat||''),
            price:Number(item.price)||0,count:counts[key]||0}))
        .sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ko'))
        .slice(0,3);
    await cacheRef.set({updatedAt:now,items});
    return {items};
});

exports.purchasePointShop = callable(async request => {
    const startedAt=Date.now();
    const current = await actor(request);
    if (current.teacher) throw new HttpsError('failed-precondition', '학생 계정에서 구매해 주세요.');
    const itemKey = request.data?.itemKey, purchaseId=request.data?.purchaseId;
    const itemName=String(request.data?.itemName||'').trim();
    if (!safeKey(itemKey) || !safeKey(purchaseId)) {
        throw new HttpsError('invalid-argument', '구매 정보가 올바르지 않습니다.');
    }
    const database = getDatabase();
    const now=Date.now();
    let resolvedItemKey=itemKey;
    let itemRef=database.ref(`shop/${resolvedItemKey}`);
    let item=(await itemRef.get()).val();
    // DB 복구 뒤 상품 push key가 바뀐 상태에서 오래 열린 화면이 이전 key를
    // 보낼 수 있다. 그 경우에만 동일한 상품명으로 현재 key를 다시 찾는다.
    if(!item&&itemName&&itemName.length<=100){
        const matched=await database.ref('shop')
            .orderByChild('name').equalTo(itemName).limitToFirst(1).get();
        matched.forEach(child=>{
            if(item)return;
            resolvedItemKey=child.key;
            item=child.val();
        });
        itemRef=database.ref(`shop/${resolvedItemKey}`);
    }
    if(!item)throw new HttpsError('not-found','상품을 찾을 수 없습니다. 상점 화면을 새로고침해 주세요.');

    const price=Number(item.price), limit=Math.max(0,Number(item.limit)||0);
    if(!Number.isSafeInteger(price)||price<0){
        throw new HttpsError('failed-precondition','상품 가격이 올바르지 않습니다.');
    }

    const initialStock=item.stock==null?-1:Number(item.stock);
    if(!Number.isFinite(initialStock)||!Number.isInteger(initialStock)||initialStock < -1){
        throw new HttpsError('failed-precondition','상품 재고가 올바르지 않습니다.');
    }
    if(item.isSoldOut===true||(initialStock!==-1&&initialStock<=0)){
        throw new HttpsError('failed-precondition','품절된 상품입니다.');
    }

    // 구매 제한이 있는 상품만 과거 주문을 확인한다. 무제한 상품은 이 조회를
    // 건너뛰어 일반 구매의 서버 왕복을 하나 줄인다.
    const priorOrders=limit>0
        ?(await database.ref(`ordersByUser/${current.name}`).get()).val()||{}
        :{};
    const legacyBought=Object.values(priorOrders).filter(order=>
        order?.shopKey===resolvedItemKey&&order?.limitReset!==true).length;

    let reason='',receipt=null;
    const userRef=database.ref(`users/${current.name}`);
    const userResult=await userRef.transaction(user=>{
        // Admin SDK도 트랜잭션 첫 호출에서 null을 줄 수 있다. actor()에서 방금
        // 확인한 학생 데이터로 첫 시도만 이어 가면 서버 값과 비교 후 자동 재시도된다.
        if(user===null)user=JSON.parse(JSON.stringify(current.user||{}));
        if(!user||typeof user!=='object'||!Object.keys(user).length){reason='missing';return;}
        user.name=String(user.name||current.name);
        user.pointShopPurchases||={};
        const existing=user.pointShopPurchases[purchaseId];
        if(existing){
            if(existing.itemKey!==resolvedItemKey){reason='request';return;}
            receipt=existing;
            return user;
        }

        const storedBought=Object.values(user.pointShopPurchases).filter(saved=>
            saved?.itemKey===resolvedItemKey&&saved?.limitReset!==true).length;
        const bought=Math.max(legacyBought,storedBought);
        const points=Number(user.points)||0;
        if(limit>0&&bought>=limit){reason='limit';return;}
        if(points<0||points<price){reason='points';return;}

        const next=points-price;
        user.points=next;
        receipt={purchaseId,itemKey:resolvedItemKey,name:String(item.name||''),price,
            balanceAfter:next,status:'charged',createdAt:now};
        user.pointShopPurchases[purchaseId]=receipt;
        return user;
    },undefined,false);

    // transaction 콜백은 충돌 시 여러 번 호출될 수 있으므로 바깥 변수만 믿지 않고
    // 최종 커밋 스냅샷에서 영수증을 다시 가져온다.
    if(userResult.committed){
        receipt=userResult.snapshot.child(`pointShopPurchases/${purchaseId}`).val()||receipt;
    }
    if(!userResult.committed||!receipt){
        const messages={missing:'학생 정보를 찾을 수 없습니다.',request:'구매 요청 정보가 충돌했습니다.',
            points:'포인트가 부족합니다.',limit:'구매 한도를 초과했습니다.'};
        throw new HttpsError('failed-precondition',messages[reason]||'구매를 완료하지 못했습니다.');
    }

    // 재고도 해당 상품에서만 예약한다. purchaseId로 재시도해도 두 번 차감되지 않는다.
    let stockReason='';
    let stockResult={committed:true};
    if(initialStock!==-1){
        const initialItem=JSON.parse(JSON.stringify(item));
        stockResult=await itemRef.transaction(saved=>{
            // Admin SDK 트랜잭션의 첫 콜백은 서버에 상품이 있어도 null로 시작할 수 있다.
            // 직전에 읽은 서버 상품으로 첫 비교를 진행하고 충돌 시 자동 재시도한다.
            if(saved===null)saved=JSON.parse(JSON.stringify(initialItem));
            if(!saved||typeof saved!=='object'){stockReason='missing';return;}
            saved.purchaseReservations||={};
            if(saved.purchaseReservations[purchaseId])return saved;
            const stock=saved.stock==null?-1:Number(saved.stock);
            if(saved.isSoldOut===true||(stock!==-1&&stock<=0)){stockReason='sold-out';return;}
            if(Number(saved.price)!==price){stockReason='changed';return;}
            if(stock>0)saved.stock=stock-1;
            saved.purchaseReservations[purchaseId]={createdAt:now};
            return saved;
        },undefined,false);
    }

    if(!stockResult.committed){
        // 재고 확보 실패 시 이 요청에서 차감한 포인트만 안전하게 되돌린다.
        await userRef.transaction(user=>{
            const saved=user?.pointShopPurchases?.[purchaseId];
            if(!saved||saved.status!=='charged')return user;
            user.points=(Number(user.points)||0)+price;
            delete user.pointShopPurchases[purchaseId];
            return user;
        },undefined,false);
        const messages={missing:'상품을 찾을 수 없습니다.','sold-out':'품절된 상품입니다.',
            changed:'상품 가격이 변경되었습니다. 다시 확인해 주세요.'};
        throw new HttpsError('failed-precondition',messages[stockReason]||'재고를 확인하지 못했습니다.');
    }

    const orderKey=purchaseId;
    const order={user:current.name,shopKey:resolvedItemKey,item:receipt.name,
        price,time:now,status:'요청'};
    const logKey=`shop_${purchaseId}`;
    const updates={
        [`orders/${orderKey}`]:order,
        [`ordersByUser/${current.name}/${orderKey}`]:order,
        [`pointLogs/${logKey}`]:{name:current.name,pAmt:-price,
            reason:`[상점 구매] ${receipt.name}`,timestamp:now},
        [`pointHistory/${current.name}/${logKey}`]:{date:kstDate(now),
            reason:`[상점 구매] ${receipt.name}`,change:-price,pChange:-price,expChange:0,
            result:receipt.balanceAfter,pointResult:receipt.balanceAfter,timestamp:now},
        [`users/${current.name}/pointShopPurchases/${purchaseId}/status`]:'completed',
        'publicShopStats/updatedAt':0
    };
    await database.ref().update(updates);
    return {orderKey,name:receipt.name,price,points:receipt.balanceAfter,
        durationMs:Date.now()-startedAt,serverVersion:'20260913-shop-4'};
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

exports.teacherQuickCheckin = callable(async request => {
    const current=await actor(request);
    if(!current.teacher)throw new HttpsError('permission-denied','교사만 출결을 처리할 수 있습니다.');
    const name=String(request.data?.name||'').trim();
    const date=String(request.data?.date||kstDate(Date.now()));
    if(!name||name.length>100||/[.#$\[\]/\u0000-\u001f]/.test(name)||!/^\d{4}-\d{2}-\d{2}$/.test(date)){
        throw new HttpsError('invalid-argument','학생 또는 날짜 정보가 올바르지 않습니다.');
    }
    const database=getDatabase();
    const userRef=database.ref(`users/${name}`);
    const userSnapshot=await userRef.get();
    if(!userSnapshot.exists())throw new HttpsError('not-found','학생 정보를 찾을 수 없습니다.');

    const records=(await database.ref('checkins').orderByChild('date').equalTo(date).get()).val()||{};
    const existingEntry=Object.entries(records).find(([,record])=>
        String(record?.name||record?.user||'')===name);
    const existingKey=existingEntry?.[0]||'';
    const previousData=existingEntry?.[1]||null;
    const previousPenalty=Number(previousData?.pointPenalty)||0;
    const pointDelta=-previousPenalty;
    const previousPoints=Number(userSnapshot.val()?.points)||0;
    let points=previousPoints;

    if(pointDelta){
        const pointsRef=userRef.child('points');
        await pointsRef.get();
        const pointResult=await pointsRef.transaction(value=>{
            points=(Number(value)||0)+pointDelta;
            return points;
        },undefined,false);
        if(!pointResult.committed)throw new HttpsError('aborted','학생 포인트를 갱신하지 못했습니다.');
        points=Number(pointResult.snapshot.val())||0;
    }

    const recordKey=existingKey||database.ref('checkins').push().key;
    const now=Date.now();
    const time=new Date(now+9*3600000).toISOString().slice(11,16);
    const record={...(previousData||{}),name,user:name,date,time,category:'정상',
        reason:'정상 등교',result:'정상 등교',pointPenalty:0,penaltySource:'none',
        lateMinutes:0,docSubmitted:Boolean(previousData?.docSubmitted),timestamp:now};
    const updates={
        [`checkins/${recordKey}`]:record,
        [`blackboardDisplay/data/checkins/${recordKey}`]:{name,date,attended:true}
    };
    if(pointDelta){
        const logKey=`teacher_checkin_${recordKey}_${now}`;
        const reason='출결 수정에 따른 지각 차감 복구';
        updates[`pointLogs/${logKey}`]={name,pAmt:pointDelta,reason,timestamp:now};
        updates[`pointHistory/${name}/${logKey}`]={date,time,reason,change:pointDelta,
            pChange:pointDelta,expChange:0,result:points,pointResult:points,timestamp:now};
    }
    try{
        await database.ref().update(updates);
    }catch(error){
        if(pointDelta)await userRef.child('points').transaction(value=>(Number(value)||0)-pointDelta);
        throw error;
    }
    return {recordKey,category:'정상',source:'teacher',lateMinutes:0,penalty:0,
        pointDelta,points,hadPrevious:Boolean(existingKey),previousData,previousPoints};
});

exports.adjustStudentScores = callable(async request => {
    const current=await actor(request);
    if(!current.teacher)throw new HttpsError('permission-denied','교사만 포인트를 변경할 수 있습니다.');
    const reason=String(request.data?.reason||'').trim();
    const requestId=String(request.data?.requestId||'');
    const targets=Array.isArray(request.data?.targets)?request.data.targets:[];
    if(!reason||reason.length>200||!safeKey(requestId)||!targets.length||targets.length>40){
        throw new HttpsError('invalid-argument','포인트 변경 정보를 확인해 주세요.');
    }
    const database=getDatabase(), now=Date.now(), date=kstDate(now);
    const time=new Date(now+9*3600000).toISOString().slice(11,16);
    const seenKeys=new Set();
    const prepared=targets.map(rawTarget=>{
        const target=rawTarget||{};
        const userKey=String(target.userKey||target.name||'').trim();
        const points=Number(target.points??target.p??0);
        const exp=Number(target.exp??0);
        if(!userKey||userKey.length>100||/[.#$\[\]/\u0000-\u001f]/.test(userKey)||
            !Number.isSafeInteger(points)||!Number.isSafeInteger(exp)||
            Math.abs(points)>100000||Math.abs(exp)>100000){
            throw new HttpsError('invalid-argument','학생별 포인트 값을 확인해 주세요.');
        }
        if(seenKeys.has(userKey))throw new HttpsError('invalid-argument','같은 학생이 두 번 선택되었습니다.');
        seenKeys.add(userKey);
        return {target,userKey,points,exp};
    });

    // 모든 대상을 먼저 한 번에 확인한다. 잘못된 학생 하나 때문에 앞 학생만
    // 반영되는 부분 성공을 막고, 순차 조회 대기 시간도 없앤다.
    const loaded=await Promise.all(prepared.map(async item=>{
        const userRef=database.ref(`users/${item.userKey}`);
        const initial=(await userRef.get()).val();
        const displayName=String(initial?.name||item.target.name||item.userKey).trim();
        if(!initial)throw new HttpsError('not-found',`${displayName} 학생 정보를 찾을 수 없습니다.`);
        return {...item,userRef,initial,displayName};
    }));

    const updateTarget=async item=>{
        const {userKey,points,exp,userRef,initial,displayName}=item;
        let receipt=null;
        const result=await userRef.transaction(user=>{
            if(user===null)user=JSON.parse(JSON.stringify(initial));
            if(!user||typeof user!=='object')return;
            // 기존 mirrorScoreChangeReceipt 트리거와 분리해 학생 수만큼 별도
            // Functions가 실행되는 일을 막는다. 최근 영수증만 남겨 레코드도 작게 유지한다.
            user.scoreAdjustmentReceipts||={};
            if(user.scoreAdjustmentReceipts[requestId]){
                receipt=user.scoreAdjustmentReceipts[requestId];
                return user;
            }
            const oldReceiptKeys=Object.entries(user.scoreAdjustmentReceipts)
                .sort((a,b)=>(Number(a[1]?.timestamp)||0)-(Number(b[1]?.timestamp)||0))
                .map(([key])=>key);
            while(oldReceiptKeys.length>=50)delete user.scoreAdjustmentReceipts[oldReceiptKeys.shift()];
            const nextPoints=(Number(user.points)||0)+points;
            const nextExp=(Number(user.exp)||0)+exp;
            receipt={name:displayName,points,exp,nextPoints,nextExp,reason,timestamp:now};
            user.points=nextPoints;
            user.exp=nextExp;
            user.scoreAdjustmentReceipts[requestId]=receipt;
            return user;
        },undefined,false);
        if(result.committed){
            receipt=result.snapshot.child(`scoreAdjustmentReceipts/${requestId}`).val()||receipt;
        }
        if(!result.committed||!receipt)throw new HttpsError('aborted',`${displayName} 포인트를 저장하지 못했습니다.`);
        const logKey=scoreLogKey(requestId,userKey);
        return {
            result:{name:displayName,userKey,points:receipt.nextPoints,exp:receipt.nextExp},
            logs:{
                [`pointLogs/${logKey}`]:{name:displayName,userKey,pAmt:points,eAmt:exp,reason,time,timestamp:now},
                [`pointHistory/${userKey}/${logKey}`]:{date,time,reason,change:points,
                    pChange:points,expChange:exp,result:receipt.nextPoints,pointResult:receipt.nextPoints,
                    expResult:receipt.nextExp,timestamp:now}
            }
        };
    };

    const completed=[];
    // 학생별 트랜잭션은 서로 독립이므로 10명씩 처리하고, 로그는 마지막에
    // 한 번의 다중 경로 업데이트로 저장한다.
    for(let index=0;index<loaded.length;index+=10){
        completed.push(...await Promise.all(loaded.slice(index,index+10).map(updateTarget)));
    }
    const logUpdates={};
    completed.forEach(item=>Object.assign(logUpdates,item.logs));
    await database.ref().update(logUpdates);
    const results=completed.map(item=>item.result);
    return {updated:results.length,results,serverVersion:'20260913-score-4'};
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
    const settingNames=['password','closeTime','lateTime','fixedExclusions'];
    const settings=Object.fromEntries(await Promise.all(settingNames.map(async key=>
        [key,(await database.ref(`settings/${key}`).get()).val()])));
    if(String(settings.password||'')!==password){
        throw new HttpsError('permission-denied','등교 암호가 맞지 않습니다.');
    }
    const close=toMinutes(settings.closeTime,9*60);
    if(currentMinutes>close){
        throw new HttpsError('failed-precondition',`등교 확인 시간이 마감되었습니다. (${String(settings.closeTime||'09:00')})`);
    }
    const late=Math.max(0,currentMinutes-toMinutes(settings.lateTime,8*60+40));
    const weekDays=['일','월','화','수','목','금','토'];
    const excluded=Array.isArray(settings.fixedExclusions?.[weekDays[clock.getUTCDay()]])&&
        settings.fixedExclusions[weekDays[clock.getUTCDay()]].includes(current.name);
    const desired=excluded?0:-Math.min(9,late);
    const category=late>0?'지각':'정상';
    const time=`${String(clock.getUTCHours()).padStart(2,'0')}:${String(clock.getUTCMinutes()).padStart(2,'0')}`;
    // 전체 출결 기록 대신 오늘 날짜만 읽어 대용량 DB의 메모리 초과를 막는다.
    const priorRecords=(await database.ref('checkins').orderByChild('date').equalTo(date).get()).val()||{};
    const priorEntry=Object.entries(priorRecords).find(([,record])=>
        String(record?.name||record?.user||'')===current.name&&record?.date===date);
    const stableKey=priorEntry?.[0]||`${current.uid}_${date}`;

    // The restored database is tens of megabytes.  A root transaction exceeded
    // the callable request/event limit, so attendance accounting is kept inside
    // the authenticated student's record and protected by database rules.
    let outcome={};
    const userResult=await database.ref(`users/${current.name}`).transaction(user=>{
        // RTDB transactions may invoke the updater once with a null local cache
        // before the server value arrives. actor() already verified this exact
        // student record, so seed that first pass instead of aborting the check-in.
        user ||= JSON.parse(JSON.stringify(current.user));
        user.attendanceState||={};
        if(user.attendanceState[date]?.receipt){
            outcome=user.attendanceState[date].receipt;
            return user;
        }
        const previousState=user.attendanceState[date]||{};
        const previous=Number(previousState.pointPenalty??priorEntry?.[1]?.pointPenalty)||0;
        const delta=desired-previous;
        user.points=(Number(user.points)||0)+delta;
        user.roomCoins=Number.isFinite(Number(user.roomCoins))?Number(user.roomCoins):10;
        user.roomCoinRewards||={};
        user.roomCoinRewards.checkin||={};
        const oldReward=user.roomCoinRewards.checkin[date];
        if(category==='정상'&&!oldReward){
            user.roomCoins+=1;
            user.roomCoinRewards.checkin[date]={amount:1,grantedAt:now};
        }
        if(category!=='정상'&&oldReward){
            user.roomCoins=Math.max(0,user.roomCoins-(Number(oldReward.amount)||1));
            delete user.roomCoinRewards.checkin[date];
        }
        user.attendanceState[date]={date,category,result:`${category} 등교`,time,
            timestamp:now,pointPenalty:desired,lateMinutes:late};
        outcome={delta,lateBy:late,penalty:desired,points:user.points,roomCoins:user.roomCoins,
            recordKey:stableKey,record:{name:current.name,user:current.name,date,category,
                reason:`${category} 등교`,result:`${category} 등교`,source:'qr',time,
                timestamp:now,pointPenalty:desired,penaltySource:late>0?'qr':'none',lateMinutes:late}};
        user.attendanceState[date].receipt=outcome;
        return user;
    },undefined,false);
    if(!userResult.committed){
        throw new HttpsError('failed-precondition','학생 정보를 찾을 수 없습니다.');
    }

    const recordKey=outcome.recordKey;
    const record=outcome.record;
    const updates={
        // Public projection target: blackboardDisplay.data.checkins
        [`checkins/${recordKey}`]:record,
        [`blackboardDisplay/data/checkins/${recordKey}`]:{name:current.name,date,attended:true}
    };
    if(outcome.delta){
        const logKey=`attendance_${recordKey}`;
        const historyKey=logKey;
        const reason=outcome.delta<0
            ?`지각 등교 자동 차감 (${late}분 지각)`
            :'출결 수정에 따른 지각 차감 복구';
        updates[`pointLogs/${logKey}`]={name:current.name,pAmt:outcome.delta,reason,timestamp:now};
        updates[`pointHistory/${current.name}/${historyKey}`]={date,reason,
            change:outcome.delta,pChange:outcome.delta,expChange:0,
            result:outcome.points,pointResult:outcome.points,timestamp:now};
    }
    await database.ref().update(updates);
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
    // Callable 응답에 아바타/방/기록 등 학생 전체 데이터를 싣지 않는다.
    // 복구된 학생 데이터가 큰 경우 전체 레코드를 반환하면 응답 크기 제한으로
    // INTERNAL(500)이 발생할 수 있다. 화면에 필요한 보상 값만 반환한다.
    const saved=result.snapshot.val()||{};
    const level=Math.max(1,Number(saved.level||saved.lv)||1);
    return {
        name:current.name,
        level,
        lv:level,
        roomCoins:Number(saved.roomCoins)||0,
        roomRewardedLevel:Number(saved.roomRewardedLevel)||level
    };
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
            if(user&&refund){
                const timestamp=Date.now();
                const nextPoints=(Number(user.points)||0)+refund;
                const reason=`[환불] ${String(order.item||'')} 승인 거절`;
                user.points=nextPoints;
                root.pointLogs||={};
                root.pointLogs[logKey]={name:order.user,pAmt:refund,reason,timestamp};
                root.pointHistory||={};
                root.pointHistory[order.user]||={};
                root.pointHistory[order.user][logKey]={date:kstDate(timestamp),reason,
                    change:refund,pChange:refund,expChange:0,result:nextPoints,
                    pointResult:nextPoints,timestamp};
            }
            delete root.orders[orderKey];
        }
        return root;
    },undefined,false);
    if(!result.committed||missing)throw new HttpsError('not-found','주문 정보를 찾을 수 없습니다.');
    return {ok:true};
});
