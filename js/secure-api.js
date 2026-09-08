(function(root){
    'use strict';
    const service = typeof firebase.functions === 'function'
        ? firebase.app().functions('asia-northeast3') : null;
    root.callSecure = async function(name, data={}) {
        if (!service) throw new Error('보안 서버 함수를 불러오지 못했습니다.');
        const result = await service.httpsCallable(name)(data);
        return result.data;
    };
})(window);
