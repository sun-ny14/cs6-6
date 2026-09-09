'use strict';

const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {onValueWritten} = require('firebase-functions/v2/database');
const {initializeApp} = require('firebase-admin/app');
const {getDatabase} = require('firebase-admin/database');
const {apply, identity, ActionError, publicData} = require('./security-core');
initializeApp();
exports.studentAction = onCall({region:'asia-northeast3',memory:'1GiB',maxInstances:3,minInstances:0,timeoutSeconds:60}, async request => {
    if (!request.auth) throw new HttpsError('unauthenticated','로그인이 필요합니다.');
    if (JSON.stringify(request.data || {}).length > 2048) throw new HttpsError('invalid-argument','요청이 너무 큽니다.');
    const ref = getDatabase().ref();
    // Read once first: prevents a null local cache from being treated as an empty database.
    const initial = await ref.get();
    try { identity(initial.val() || {},request.auth); }
    catch (error) { throw new HttpsError(error.code || 'permission-denied',error.message); }
    let response;
    const now = Date.now();
    try {
        const result = await ref.transaction(current => {
            if (current === null) return current;
            const next = JSON.parse(JSON.stringify(current));
            response = apply(next,request.auth,request.data,now);
            return next;
        },undefined,false);
        if (!result.committed || !response) throw new HttpsError('unavailable','저장을 확인하지 못했습니다. 같은 요청으로 다시 시도하세요.');
        return response;
    } catch (error) {
        if (error instanceof ActionError) throw new HttpsError(error.code,error.message);
        if (error instanceof HttpsError) throw error;
        console.error('studentAction failed',error.code);
        throw new HttpsError('unavailable','저장을 확인하지 못했습니다. 잠시 후 다시 시도하세요.');
    }
});
exports.migratePublicData = onCall({region:'asia-northeast3',memory:'1GiB',maxInstances:1,minInstances:0,timeoutSeconds:120}, async request=>{
    if(request.auth?.token?.email!=='ksosuny@cberi.go.kr'||request.auth.token.email_verified!==true){
        throw new HttpsError('permission-denied','관리자만 실행할 수 있습니다.');
    }
    const db=getDatabase();
    const migrated=Number((await db.ref('securityMigrationVersion').get()).val())||0;
    if(migrated>=2)return {alreadyMigrated:true};
    const users=(await db.ref('users').get()).val()||{};
    const projection=publicData(users);
    const updates={publicStudents:projection.publicStudents,securityMigrationVersion:2};
    if(migrated<1)updates.rooms=projection.rooms;
    await db.ref().update(updates);
    return {students:Object.keys(projection.publicStudents).length,rooms:Object.keys(projection.rooms).length};
});

// 학생 전체 데이터가 큰 경우 트리거 한도를 넘지 않도록 숫자 필드만 동기화함.
exports.syncPublicStudent = onValueWritten({ref:'/users/{userName}/points',region:'us-central1'},async event=>{
    const name=event.params.userName;
    const target=getDatabase().ref(`publicStudents/${name}/points`);
    if(!event.data.after.exists())return target.remove();
    return target.set(event.data.after.val());
});

exports.syncPublicExperience = onValueWritten({ref:'/users/{userName}/exp',region:'us-central1'},async event=>{
    const name=event.params.userName;
    const target=getDatabase().ref(`publicStudents/${name}/exp`);
    if(!event.data.after.exists())return target.remove();
    return target.set(event.data.after.val());
});
