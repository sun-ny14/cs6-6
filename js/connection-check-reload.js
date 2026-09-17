// connection-check.html의 인라인 onclick="location.reload()"를 분리했습니다.
document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.getElementById('reload-check-btn');
    if(btn)btn.addEventListener('click',()=>location.reload());
});
