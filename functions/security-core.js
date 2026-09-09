'use strict';
const catalog = require('./housing-catalog');
const ADMIN = 'ksosuny@cberi.go.kr';
class ActionError extends Error {
    constructor(message, code = 'failed-precondition') { super(message); this.code = code; }
}
const fail = message => { throw new ActionError(message); };
const key = value => typeof value === 'string' && /^[^.#$\[\]/\u0000-\u001f]{1,100}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
const integer = value => Number.isSafeInteger(value);
function identity(root, auth) {
    if (!auth?.uid || auth.token?.email_verified !== true || auth.token?.firebase?.sign_in_provider !== 'google.com') {
        throw new ActionError('Google 계정으로 다시 로그인해 주세요.', 'unauthenticated');
    }
    const email = String(auth.token.email || '').toLowerCase();
    const admin = email === ADMIN;
    const name = root.userEmails?.[email.replace(/\./g, ',')];
    if (!key(name) || !root.users?.[name] || String(root.users[name].email || '').toLowerCase() !== email) {
        throw new ActionError('등록된 학생 계정을 확인할 수 없습니다.', 'permission-denied');
    }
    return { name, admin, user: root.users[name] };
}
function rewards(user) {
    const level = Math.max(1, parseInt(user.level || user.lv, 10) || 1);
    if (!integer(user.roomCoins)) user.roomCoins = 10;
    if (!integer(user.roomRewardedLevel)) user.roomRewardedLevel = level;
    if (level > user.roomRewardedLevel) {
        user.roomCoins += (level - user.roomRewardedLevel) * 5;
        user.roomRewardedLevel = level;
    }
}
function apply(root, auth, input, now) {
    const {name, user} = identity(root, auth);
    if (!input || typeof input !== 'object' || !key(input.requestId) || !/^[A-Za-z0-9_-]{12,80}$/.test(input.requestId)) fail('요청 번호를 확인해 주세요.');
    const allowed = ['buy', 'checkin', 'housingBuy', 'housingRewards', 'useItem', 'reaction', 'profile', 'roomPlace', 'approveOrder', 'rejectOrder'];
    if (!allowed.includes(input.action)) throw new ActionError('허용되지 않은 작업입니다.', 'permission-denied');
    const roleValue=root.settings?.studentRoles?.[name];
    const assignedRole=typeof roleValue==='string' ? roleValue : String(roleValue?.role||roleValue?.name||roleValue?.title||'');
    const shopManager=user.role==='상점'||user.isHelper===true||assignedRole==='상점';
    if (['approveOrder','rejectOrder'].includes(input.action) && !shopManager) {
        throw new ActionError('상점 담당 학생만 처리할 수 있습니다.','permission-denied');
    }
    const requestKey = `${auth.uid}_${input.requestId}`;
    if (!key(requestKey)) fail('잘못된 사용자 식별자입니다.');
    const signature = JSON.stringify([input.action, input.itemKey || '', input.orderKey || '', input.target || '', input.type || '', input.img || '', input.animal || '', input.title || '']);
    const prior = root.secureReceipts?.[requestKey];
    if (prior) {
        if (prior.signature !== signature) fail('같은 요청 번호로 다른 작업을 할 수 없습니다.');
        return prior.result;
    }
    const date = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
    const time = new Date(now + 9 * 3600000).toISOString().slice(11, 16);
    const log = (amount, reason) => {
        if (!integer(user.points)) user.points = 0;
        user.points += amount;
        if (!integer(user.points)) fail('포인트 범위를 확인해 주세요.');
        root.pointLogs ||= {};
        root.pointLogs[requestKey] = {name, pAmt:amount, reason, time:`${date} ${time}`, timestamp:now};
        root.pointHistory ||= {}; root.pointHistory[name] ||= {};
        root.pointHistory[name][requestKey] = {date,time,reason,change:amount,pChange:amount,expChange:0,result:user.points,pointResult:user.points,timestamp:now};
    };
    let result;
    if (input.action === 'approveOrder' || input.action === 'rejectOrder') {
        if (!key(input.orderKey)) fail('주문을 확인해 주세요.');
        const order=root.orders?.[input.orderKey];
        if (!order || !key(order.user) || !root.users?.[order.user]) fail('주문을 찾을 수 없습니다.');
        if (!['요청','사용요청','대기','환불'].includes(order.status)) fail('이미 처리된 주문입니다.');
        if (input.action === 'approveOrder') {
            const reset=/\(요청:\s*(.+)\)/.exec(order.item||'');
            if (reset) Object.values(root.orders||{}).forEach(past=>{
                if(past.user===order.user&&past.item===reset[1])past.item=`${reset[1]} (한도리셋)`;
            });
            order.status='완료';
            result={message:'사용 요청을 승인했습니다.'};
        } else {
            const amount=Number(order.price);
            if (!integer(amount)||amount<0) fail('환불 금액을 확인할 수 없습니다.');
            const buyer=root.users[order.user];
            if(!integer(buyer.points))buyer.points=0;
            buyer.points+=amount;
            root.pointLogs ||= {};root.pointHistory ||= {};root.pointHistory[order.user] ||= {};
            root.pointLogs[requestKey]={name:order.user,pAmt:amount,reason:`[환불] ${order.item} 승인 거절`,time:`${date} ${time}`,timestamp:now};
            root.pointHistory[order.user][requestKey]={date,time,reason:`[환불] ${order.item} 승인 거절`,change:amount,pChange:amount,expChange:0,result:buyer.points,pointResult:buyer.points,timestamp:now};
            delete root.orders[input.orderKey];
            result={message:`요청을 거절하고 ${amount}P를 환불했습니다.`};
        }
    } else if (input.action === 'buy') {
        if (!key(input.itemKey)) fail('상품을 확인해 주세요.');
        const item = root.shop?.[input.itemKey];
        if (!item || !integer(item.price) || item.price < 0 || !item.name) fail('구매할 수 없는 상품입니다.');
        if (item.isSoldOut || (item.stock != null && item.stock !== -1 && (!integer(item.stock) || item.stock <= 0))) fail('품절된 상품입니다.');
        if (!integer(user.points) || user.points < item.price) fail('포인트가 부족합니다.');
        const count = Object.values(root.orders || {}).filter(o => o.user === name && o.item === item.name).length;
        if (Number(item.limit) > 0 && count >= Number(item.limit)) fail('구매 한도에 도달했습니다.');
        if (item.stock > 0) item.stock -= 1;
        log(-item.price, `[상점 구매] ${item.name}`);
        root.orders ||= {};
        root.orders[requestKey] = {user:name,item:item.name,price:item.price,time:now,status:'요청',itemKey:input.itemKey};
        result = {message:'구매 완료!', points:user.points};
    } else if (input.action === 'checkin') {
        const settings = root.settings || {};
        if (!/^\d{4}$/.test(String(settings.password || '')) || input.password !== String(settings.password)) fail('등교 암호가 맞지 않습니다.');
        const entries = Object.entries(root.checkins || {}).filter(([,r]) => (r.user || r.name) === name && r.date === date);
        if (entries.length) {
            result = {message:'오늘 출결이 이미 기록되어 있습니다. 수정은 선생님께 요청하세요.'};
        } else {
            const minutes = v => { const m = /^(\d{2}):(\d{2})$/.exec(v); if (!m || +m[1]>23 || +m[2]>59) fail('등교 시간 설정을 확인해 주세요.'); return +m[1]*60 + +m[2]; };
            const current = minutes(time);
            if (current > minutes(settings.closeTime || '09:00')) fail('등교 확인 시간이 마감되었습니다.');
            const late = Math.max(0,current-minutes(settings.lateTime || '08:40'));
            const day = ['일','월','화','수','목','금','토'][new Date(now + 9 * 3600000).getUTCDay()];
            const excluded = Array.isArray(settings.fixedExclusions?.[day]) && settings.fixedExclusions[day].includes(name);
            const penalty = excluded ? 0 : -Math.min(9,late);
            const category = late ? '지각' : '정상';
            root.checkins ||= {};
            root.checkins[requestKey] = {user:name,name,date,time,category,reason:`${category} 등교`,result:`${category} 등교`,subCategory:'해당없음',pointPenalty:penalty,penaltySource:'qr',lateMinutes:late,timestamp:now,docSubmitted:false};
            root.blackboardDisplay ||= {}; root.blackboardDisplay.data ||= {}; root.blackboardDisplay.data.checkins ||= {};
            root.blackboardDisplay.data.checkins[requestKey] = {name,date,attended:true};
            if (penalty) log(penalty,`지각 등교 자동 차감 (${late}분 지각)`);
            rewards(user);
            if (!late) {
                user.roomCoinRewards ||= {}; user.roomCoinRewards.checkin ||= {};
                if (!user.roomCoinRewards.checkin[date]) {
                    user.roomCoins += 1;
                    user.roomCoinRewards.checkin[date] = {amount:1,timestamp:now};
                }
            }
            result = {message:late ? `${late}분 지각 · ${Math.abs(penalty)}포인트 차감` : '정상 등교 완료!', penalty};
        }
    } else if (input.action === 'housingRewards' || input.action === 'housingBuy') {
        if (root.settings?.housingEnabled === false) fail('지금은 방꾸미기를 사용할 수 없습니다.');
        rewards(user);
        if (input.action === 'housingBuy') {
            if (!key(input.itemKey)) fail('가구를 확인해 주세요.');
            const item = catalog[input.itemKey] || root.housingShop?.[input.itemKey];
            if (!item || !integer(item.price) || item.price < 0 || String(item.category).includes('배경')) fail('구매할 수 없는 가구입니다.');
            const builtin = Object.values(catalog).find(c => c.img === (item.img || item.url));
            const required = Math.max(1,Number(item.requiredLevel)||1,builtin?.requiredLevel||1);
            if (Math.max(1,Number(user.level || user.lv)||1) < required) fail(`Lv.${required}부터 구매할 수 있습니다.`);
            if (user.roomCoins < item.price) fail('방꾸미기 코인이 부족합니다.');
            user.roomCoins -= item.price;
            user.housingInventory ||= {}; user.housingPurchases ||= {};
            user.housingInventory[requestKey] = {shopKey:input.itemKey,name:item.name,category:item.category || '가구',img:item.img || item.url || '',purchasedAt:now};
            user.housingPurchases[requestKey] = {itemKey:input.itemKey,name:item.name,price:item.price,listPrice:item.price,teacherFree:false,currency:'C',balanceAfter:user.roomCoins,inventoryKey:requestKey,timestamp:now};
        }
        result = {message:'방꾸미기 정보가 저장되었습니다.',roomCoins:user.roomCoins};
    } else if (input.action === 'useItem') {
        if (!key(input.orderKey)) fail('주문을 확인해 주세요.');
        const order = root.orders?.[input.orderKey];
        if (!order || order.user !== name) throw new ActionError('본인 아이템만 사용할 수 있습니다.','permission-denied');
        if (!['대기','요청','환불'].includes(order.status)) fail('이미 요청했거나 사용한 아이템입니다.');
        if (/리셋|초기화/.test(order.item)) {
            const target = input.target;
            if (typeof target !== 'string' || !Object.values(root.orders || {}).some(o => o.user===name && o.item===target && !/리셋|초기화/.test(o.item))) fail('구매한 상품을 선택해 주세요.');
            order.item = `${order.item} (요청: ${target})`;
        }
        order.status = '사용요청';
        result = {message:'선생님께 사용 요청을 보냈습니다.'};
    } else if (input.action === 'profile') {
        const animals=['귀여운','신사','사랑스러운','패셔니스타','밥먹는','날쌘돌이','즐거운','행복한','정의로운','천사','닌자','왕자','공주','근육맨','마법사','용사','공부하는','춤추는','노래하는','무지개'];
        const level=Math.max(1,Number(user.level || user.lv)||1);
        const titles=[[1,'모험가'],[3,'견습 용사'],[5,'용감한 용사'],[7,'정예 용사'],[10,'빛나는 용사'],[12,'왕국 수호자'],[15,'전설의 용사'],[20,'마스터 용사']].filter(([l])=>l<=level).map(([,t])=>t);
        const earned=[user.unlockedTitles,user.earnedTitles,user.titles].find(Array.isArray)||[];
        if (!animals.slice(0,level).includes(input.animal) || ![...titles,...earned].includes(input.title)) fail('해금된 캐릭터와 칭호만 선택할 수 있습니다.');
        user.animal=user.selectedAnimal=input.animal;
        user.title=user.selectedTitle=input.title;
        root.publicStudents ||= {};
        root.publicStudents[name]=publicStudent(name,user);
        result={message:'용사 모습을 저장했습니다.'};
    } else if (input.action === 'roomPlace') {
        if (root.settings?.housingEnabled === false) fail('지금은 방꾸미기를 사용할 수 없습니다.');
        root.rooms ||= {};
        const room=root.rooms[name] ||= {};
        if (input.type === '배경') {
            const levels=[1,3,5,8,12,16,20];
            const level=levels.find(l=>input.img===`assets/housing/backgrounds/level-${l}.png`);
            if (!level || level>Math.max(1,Number(user.level||user.lv)||1)) fail('해금된 배경만 선택할 수 있습니다.');
            room.background=input.img;
        } else {
            const item=key(input.itemKey) ? user.housingInventory?.[input.itemKey] : null;
            if (!item) fail('보관함에 있는 가구만 배치할 수 있습니다.');
            room.objects ||= {};
            if (Object.keys(room.objects).length>=100) fail('방에는 최대 100개까지 배치할 수 있습니다.');
            room.objects[requestKey]={img:item.img,type:item.category,x:290,y:210};
        }
        result={message:'방에 적용했습니다.'};
    } else {
        if (!key(input.target) || !root.users?.[input.target] || input.target === name) fail('방 주인을 확인해 주세요.');
        if (!['likes','hearts','stars','smiles'].includes(input.type)) fail('허용되지 않은 반응입니다.');
        const room = root.rooms[input.target] ||= {};
        room.dailyReactions ||= {}; room.dailyReactions[name] ||= {};
        if (!room.dailyReactions[name][date]) {
            room.dailyReactions[name][date] = input.type;
            room.guestbook ||= {}; room.guestbook[requestKey] = {user:name,type:input.type,day:date,timestamp:now};
            room[input.type] = (Number(room[input.type]) || 0) + 1;
        }
        result = {message:'오늘의 반응을 저장했습니다.'};
    }
    // 학생 본인의 게임 수치가 바뀌면 공개 용사 카드도 즉시 갱신함.
    root.publicStudents ||= {};
    root.publicStudents[name]=publicStudent(name,user);
    root.secureReceipts ||= {};
    root.secureReceipts[requestKey] = {signature,result,timestamp:now};
    return result;
}
function publicStudent(name,user){
    const result={name};
    for(const field of ['no','number','points','exp','experience','level','lv','animal','selectedAnimal','title','selectedTitle']){
        if(user[field]!==undefined)result[field]=user[field];
    }
    return result;
}
function publicData(users){
    const publicStudents={},rooms={};
    for(const [name,user] of Object.entries(users||{})){
        if(!user||typeof user!=='object')continue;
        publicStudents[name]=publicStudent(name,user);
        if(user.myRoom)rooms[name]=JSON.parse(JSON.stringify(user.myRoom));
    }
    return {publicStudents,rooms};
}
module.exports = {apply, identity, ActionError, publicStudent, publicData};
