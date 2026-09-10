const {test}=require('node:test');
const assert=require('node:assert/strict');
const {apply,identity}=require('../functions/security-core');
const auth={uid:'student01',token:{email:'student@example.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}};
const now=Date.parse('2026-09-08T08:43:00+09:00');
const request=(action,extra={})=>({action,requestId:'request-00000001',...extra});
const data=()=>({userEmails:{'student@example,com':'학생'},users:{'학생':{email:'student@example.com',points:100,exp:20,level:3}},shop:{pencil:{name:'연필',price:10,stock:2,limit:1}},settings:{password:'1234',passwordDate:'2026-09-01',lateTime:'08:40',closeTime:'09:00'},housingShop:{}});
test('unverified, non-Google and unregistered identities are denied',()=>{
 for(const a of [null,{...auth,token:{...auth.token,email_verified:false}},{...auth,token:{...auth.token,firebase:{sign_in_provider:'password'}}},{...auth,token:{...auth.token,email:'other@example.com'}}])assert.throws(()=>identity(data(),a));
});
test('client price, identity and reward are ignored; server charges stored price',()=>{
 const root=data();apply(root,auth,request('buy',{itemKey:'pencil',price:-999,name:'다른학생',points:9999}),now);
 assert.equal(root.users['학생'].points,90);assert.equal(root.users['학생'].exp,20);assert.equal(root.shop.pencil.stock,1);
 assert.equal(Object.values(root.orders)[0].user,'학생');
});
test('repeated request cannot charge twice and new request obeys purchase limit',()=>{
 const root=data(),r=request('buy',{itemKey:'pencil'});
 const first=apply(root,auth,r,now);assert.deepEqual(apply(root,auth,r,now),first);assert.equal(root.users['학생'].points,90);
 assert.throws(()=>apply(root,auth,{...r,requestId:'request-00000002'},now));
});
test('out of stock, nonexistent, invalid price and insufficient funds purchases fail',()=>{
 for(const change of [r=>r.shop.pencil.stock=0,r=>delete r.shop.pencil,r=>r.shop.pencil.price=-1,r=>r.users['학생'].points=0]){
  const root=data();change(root);assert.throws(()=>apply(root,auth,request('buy',{itemKey:'pencil'}),now));
 }
});
test('student cannot invoke admin actions or reuse receipt with another operation',()=>{
 const root=data();assert.throws(()=>apply(root,auth,request('grantPoints',{points:999}),now));
 apply(root,auth,request('buy',{itemKey:'pencil'}),now);
 assert.throws(()=>apply(root,auth,request('housingRewards'),now));
});
test('server time sets lateness and old password date stays valid',()=>{
 const root=data();apply(root,auth,request('checkin',{password:'1234',lateMinutes:0,pointPenalty:0}),now);
 assert.equal(root.users['학생'].points,97);
 assert.equal(Object.values(root.checkins)[0].lateMinutes,3);
 assert.equal(Object.values(root.blackboardDisplay.data.checkins)[0].attended,true);
});
test('wrong password and closed check-in fail',()=>{
 assert.throws(()=>apply(data(),auth,request('checkin',{password:'0000'}),now));
 assert.throws(()=>apply(data(),auth,request('checkin',{password:'1234'}),now+3600000));
});
test('excluded student is not penalized and teacher absence cannot be overwritten',()=>{
 const root=data();root.settings.fixedExclusions={'화':['학생']};apply(root,auth,request('checkin',{password:'1234'}),now);assert.equal(root.users['학생'].points,100);
 const absent=data();absent.checkins={teacherRecord:{name:'학생',date:'2026-09-08',category:'결석'}};
 apply(absent,auth,request('checkin',{password:'1234'}),now);assert.equal(absent.checkins.teacherRecord.category,'결석');assert.equal(Object.keys(absent.checkins).length,1);
});
test('normal check-in reward is once per day despite new request IDs',()=>{
 const root=data();const r=request('checkin',{password:'1234'});
 apply(root,auth,r,now-600000);apply(root,auth,{...r,requestId:'request-00000002'},now-600000);
 assert.equal(root.users['학생'].roomCoins,11);
});
test('housing uses authoritative catalog and cannot farm level rewards',()=>{
 const root=data();apply(root,auth,request('housingBuy',{itemKey:'builtin-chair',price:-50}),now);
 assert.equal(root.users['학생'].roomCoins,7);
 apply(root,auth,request('housingRewards',{requestId:'request-00000002',level:99,roomCoins:999}),now);
 assert.equal(root.users['학생'].roomCoins,7);
});
test('another student order cannot be requested or approved',()=>{
 const root=data();root.orders={order:{user:'다른학생',item:'연필',status:'요청'}};
 assert.throws(()=>apply(root,auth,request('useItem',{orderKey:'order'}),now));
 root.orders.order.user='학생';apply(root,auth,request('useItem',{orderKey:'order',status:'완료'}),now);
 assert.equal(root.orders.order.status,'사용요청');
});
test('profile changes cannot unlock high-level avatars or grant levels',()=>{
 const root=data();assert.throws(()=>apply(root,auth,request('profile',{animal:'무지개',title:'마스터 용사'}),now));
 apply(root,auth,request('profile',{animal:'귀여운',title:'모험가',level:99}),now);
 assert.equal(root.users['학생'].selectedAnimal,'귀여운');assert.equal(root.users['학생'].level,3);
});
test('room placement requires owned inventory and checks background level',()=>{
 const root=data();assert.throws(()=>apply(root,auth,request('roomPlace',{itemKey:'free',type:'가구'}),now));
 assert.throws(()=>apply(root,auth,request('roomPlace',{type:'배경',img:'assets/housing/backgrounds/level-20.png'}),now));
 root.users['학생'].housingInventory={mine:{img:'assets/housing/furniture/chair.png',category:'가구'}};
 apply(root,auth,request('roomPlace',{itemKey:'mine',type:'가구'}),now);
 assert.equal(Object.values(root.rooms['학생'].objects)[0].img,'assets/housing/furniture/chair.png');
});
