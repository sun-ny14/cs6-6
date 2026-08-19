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
const auth = firebase.auth(); 
const provider = new firebase.auth.GoogleAuthProvider();

// 전역(Global) 변수들 선언 (다른 js 파일에서도 함께 사용됨)
let myName = "";
let isAdmin = false;
let isHelper = false;
let currentUsers = [];
let routineItems = [];
let giftList = [];
let rIdx = 0;
let currentTab = sessionStorage.getItem('activeTab') || 'main';
let currentShopCat = "전체";
let currentLayout = {}; 
let isEditMode = false;
let selectedStudentForMove = null;
let isCheckingIn = false;
let isHousingEnabled = true;
let totalBudget = 100000;
