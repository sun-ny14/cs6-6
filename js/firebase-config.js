// js/firebase-config.js
// Firebase 초기화 및 공통 전역 변수 설정

const firebaseConfig = { 
    apiKey: "AIzaSyDWdWrw8LJ6tSiyF1X5tENJEvBfY-DzSw0", 
    authDomain: "cs6-6class.firebaseapp.com", 
    databaseURL: "https://cs6-6class-default-rtdb.firebaseio.com/", 
    projectId: "cs6-6class", 
    storageBucket: "cs6-6class.firebasestorage.app", 
    messagingSenderId: "644235499537", 
    appId: "1:644235499537:web:2ede2611f4ec6a3e8179b0" 
};

const adminEmail = "ksosuny@cberi.go.kr"; 

// Firebase 초기화
firebase.initializeApp(firebaseConfig); 
const db = firebase.database(); 
// 전자칠판처럼 공개 읽기 전용 페이지는 Auth SDK를 불러오지 않습니다.
const auth = typeof firebase.auth === 'function' ? firebase.auth() : null;
const provider = auth ? new firebase.auth.GoogleAuthProvider() : null;

// 앱 전체가 같은 상태를 보도록 window 한 곳에서만 관리합니다.
// top-level let과 window.*를 섞으면 서로 다른 값이 생길 수 있습니다.
window.myName = "";
window.isAdmin = false;
window.isHelper = false;
window.currentUsers = [];
window.routineItems = [];
window.giftList = [];
window.rIdx = 0;
window.currentTab = sessionStorage.getItem('activeTab') || 'main';
window.currentShopCat = "전체";
window.currentLayout = {};
window.currentRows = 6;
window.currentCols = 5;
window.isEditMode = false;
window.selectedStudentForMove = null;
window.isCheckingIn = false;
window.isHousingEnabled = true;
window.totalBudget = 100000;
