// 오늘의 기분: 감정 목록과 주 계산. 학생 화면(브라우저)과 서버 함수가 같은 목록을 쓴다.
// 저장은 이모지가 아니라 감정 이름("졸려요")으로 한다. 이모지는 화면에 보여 줄 때만 쓴다.
(function (root) {
    'use strict';
    const EMOTIONS = [
        { name:'행복해요', emoji:'😊', tone:'좋음' }, { name:'신나요', emoji:'🥳', tone:'좋음' },
        { name:'기뻐요', emoji:'😄', tone:'좋음' }, { name:'설레요', emoji:'🥰', tone:'좋음' },
        { name:'뿌듯해요', emoji:'😎', tone:'좋음' }, { name:'자신 있어요', emoji:'💪', tone:'좋음' },
        { name:'감사해요', emoji:'🙏', tone:'좋음' }, { name:'편안해요', emoji:'😌', tone:'좋음' },
        { name:'재밌어요', emoji:'😆', tone:'좋음' }, { name:'든든해요', emoji:'🤗', tone:'좋음' },
        { name:'평범해요', emoji:'😐', tone:'보통' }, { name:'졸려요', emoji:'😴', tone:'보통' },
        { name:'피곤해요', emoji:'🥱', tone:'보통' }, { name:'배고파요', emoji:'🤤', tone:'보통' },
        { name:'궁금해요', emoji:'🤔', tone:'보통' }, { name:'멍해요', emoji:'😶', tone:'보통' },
        { name:'걱정돼요', emoji:'😟', tone:'힘듦' }, { name:'불안해요', emoji:'😰', tone:'힘듦' },
        { name:'긴장돼요', emoji:'😬', tone:'힘듦' }, { name:'슬퍼요', emoji:'😢', tone:'힘듦' },
        { name:'속상해요', emoji:'😞', tone:'힘듦' }, { name:'화나요', emoji:'😠', tone:'힘듦' },
        { name:'짜증나요', emoji:'😤', tone:'힘듦' }, { name:'외로워요', emoji:'🥺', tone:'힘듦' },
        { name:'아파요', emoji:'🤒', tone:'힘듦' }
    ];
    const HIDDEN_EMOJI = '😶';
    const HIDDEN_PER_WEEK = 2;

    const byName = name => EMOTIONS.find(item => item.name === String(name || '').trim()) || null;

    // 월요일을 한 주의 시작으로 본 그 주의 월요일 날짜(YYYY-MM-DD). 비공개 횟수를 주마다 센다.
    function weekStart(dateString) {
        const date = new Date(`${dateString}T00:00:00Z`);
        const day = date.getUTCDay();
        date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
        return date.toISOString().slice(0, 10);
    }

    const api = { EMOTIONS, HIDDEN_EMOJI, HIDDEN_PER_WEEK, byName, weekStart };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.MoodCore = api;
})(typeof window !== 'undefined' ? window : null);
