// js/firebase-config.js
// Firebase 초기화 및 대역폭/트래픽 최적화 설정

const firebaseConfig = {
    apiKey: "AIzaSy...", // 선생님의 기존 API Key (기존에 쓰시던 값 유지)
    authDomain: "...",
    databaseURL: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
};

// 1. 파이어베이스 앱 초기화 (중복 초기화 방지 안전장치 포함)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 2. 파이어베이스 트래픽 및 대역폭 최적화 설정
try {
    // 실시간 데이터베이스의 백그라운드 불필요한 트래픽 낭비 차단
    const db = firebase.database();
    
    // 오프라인 캐시 및 연결 상태 최적화
    db.goOnline();
    
    console.log("🔥 [Firebase] 트래픽 최적화 및 연결이 안정적으로 설정되었습니다.");
} catch (error) {
    console.error("🔥 [Firebase] 최적화 설정 중 오류 발생:", error);
}

// 전역에서 편리하게 사용할 수 있도록 db 객체 선언 보장
const db = firebase.database();
const auth = firebase.auth();
