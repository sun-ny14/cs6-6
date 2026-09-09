const {test, before, after} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {ref,set,get,update,remove,query,orderByChild,equalTo}=require('firebase/database');
let env,student,teacher,outsider,anonymous;
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-cs66-security',database:{host:'127.0.0.1',port:9000,rules:fs.readFileSync(path.join(__dirname,'../database.rules.json'),'utf8')}});
 const token=email=>({email,email_verified:true,firebase:{sign_in_provider:'google.com'}});
 student=env.authenticatedContext('student',token('student@example.com')).database();
 teacher=env.authenticatedContext('teacher',token('ksosuny@cberi.go.kr')).database();
 outsider=env.authenticatedContext('outsider',token('outsider@example.com')).database();
 anonymous=env.unauthenticatedContext().database();
 await env.withSecurityRulesDisabled(async c=>set(ref(c.database()),{
  userEmails:{'student@example,com':'학생'},users:{'학생':{email:'student@example.com',points:100,exp:10,level:1,isHelper:true,role:'상점'},'친구':{email:'friend@example.com',points:20}},
  settings:{password:'1234',budgetTotal:50000,lateTime:'08:40'},grades:{private:1},budgetRecords:{private:1},checkins:{private:1},
  orders:{mine:{user:'학생',item:'연필',status:'요청'},other:{user:'친구',item:'연필'}},blackboardDisplay:{schemaVersion:1,data:{}}
 }));
});
after(async()=>{await env?.cleanup();});
for(const field of ['points','exp','level','lv','roomCoins','roomRewardedLevel','isAdmin','isHelper','role','email','name','housingInventory','housingPurchases','roomCoinRewards']) {
 test(`student cannot overwrite protected user field ${field}`,async()=>{await assertFails(set(ref(student,`users/학생/${field}`),9999));});
}
test('student cannot delete user or replace whole record or bypass via multipath',async()=>{
 await assertFails(remove(ref(student,'users/학생')));
 await assertFails(set(ref(student,'users/학생'),{email:'student@example.com',points:9999}));
 await assertFails(update(ref(student),{'users/학생/points':9999,'pointLogs/fake':{name:'학생',pAmt:9999}}));
});
for(const location of ['grades','budgetRecords','settings','settings/budgetTotal','checkins','checkinLogs','classManagement','blackboard/weeklySchedules','secureReceipts']){
 test(`teacher-only ${location} denies student read/write even with helper role`,async()=>{
  await assertFails(get(ref(student,location)));await assertFails(set(ref(student,location),{fake:true}));
  await assertSucceeds(get(ref(teacher,location)));
 });
}
test('student cannot forge orders, logs, prices or public attendance',async()=>{
 for(const p of ['orders/mine/status','pointLogs/fake','pointHistory/학생/fake','shop/pencil/price','blackboardDisplay/data/checkins/fake','blackboardDisplay/data/cleaningRoot/fake'])await assertFails(set(ref(student,p),'완료'));
});
test('administrator can grant points and save protected settings',async()=>{
 await assertSucceeds(update(ref(teacher),{'users/학생/points':110,'settings/password':'4321'}));
});
test('anonymous board remains readable but never writable',async()=>{
 await assertSucceeds(get(ref(anonymous,'blackboardDisplay')));
 await assertFails(set(ref(anonymous,'blackboardDisplay/data'),{}));await assertFails(get(ref(anonymous,'users')));
});
test('unregistered and unverified accounts cannot read students',async()=>{
 await assertFails(get(ref(outsider,'users')));
 const db=env.authenticatedContext('fake',{email:'student@example.com',email_verified:false}).database();await assertFails(get(ref(db,'users')));
});
test('direct profile edits denied; server validates unlocked choices',async()=>{
 await assertFails(update(ref(student,'users/학생'),{animal:'귀여운',selectedAnimal:'귀여운',title:'모험가',selectedTitle:'모험가'}));
 await assertFails(set(ref(student,'users/학생/title'),'<img onerror=alert(1)>'));
 await assertFails(set(ref(student,'users/친구/title'),'모험가'));
});
test('orders must be filtered to the authenticated owner',async()=>{
 await assertFails(get(ref(student,'orders')));
 await assertSucceeds(get(query(ref(student,'orders'),orderByChild('user'),equalTo('학생'))));
 await assertFails(get(query(ref(student,'orders'),orderByChild('user'),equalTo('친구'))));
});
