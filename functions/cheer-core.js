// 이모지 응원: 쓸 수 있는 이모지 목록. 학생 화면(브라우저)과 서버 함수가 같은 목록을 쓴다.
// 응원은 cheers/{날짜}/{받는 학생}/{보낸 학생}에 이모지 하나로 저장된다(친구마다 하루 한 번).
(function (root) {
    'use strict';
    const CHEER_EMOJIS = [
        { emoji: '👏', label: '박수' }, { emoji: '💪', label: '힘내' }, { emoji: '🥰', label: '사랑해' }, { emoji: '🎉', label: '축하해' },
        { emoji: '👍', label: '최고야' }, { emoji: '🌟', label: '멋져' }, { emoji: '😊', label: '반가워' }
    ];
    const byEmoji = emoji => CHEER_EMOJIS.find(item => item.emoji === String(emoji || '')) || null;
    const api = { CHEER_EMOJIS, byEmoji };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.CheerCore = api;
})(typeof window !== 'undefined' ? window : null);
