const cardContainer = document.getElementById('interactive-card');
const cardElement = document.getElementById('card-element');
const themeToggleBtn = document.getElementById('theme-toggle');
const pauseToggleBtn = document.getElementById('pause-toggle');
const spinTriggerBtn = document.getElementById('spin-trigger');
const loginForm = document.getElementById('login-form');

let isPaused = false;
let isDarkMode = true;
let isFlipped = false;

let targetRotateX = 0, targetRotateY = 0;
let currentRotateX = 0, currentRotateY = 0;
let targetGlintX = 50, targetGlintY = 50;
let currentGlintX = 50, currentGlintY = 50;
let spinYAngle = 0, currentSpinYAngle = 0;
let mouseStopTimer;

themeToggleBtn.textContent = 'LIGHT MODE';

// 💡 [추가] 로그인 비동기 연동 처리
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            // 로그인 성공 시 이동
            window.location.href = '/dashboard';
        } else {
            const errorText = await response.text();
            alert(errorText || '로그인 실패. 정보를 확인하세요.');
        }
    } catch (err) {
        alert('서버 연결 실패. 나중에 다시 시도하세요.');
    }
});

themeToggleBtn.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    themeToggleBtn.textContent = isDarkMode ? 'LIGHT MODE' : 'DARK MODE';
    if (isFlipped) {
        isFlipped = false;
        spinYAngle = 0;
        targetRotateX = 0;
        targetRotateY = 0;
        targetGlintX = 50;
        targetGlintY = 50;
        cardElement.classList.remove('is-login');
        spinTriggerBtn.textContent = 'LOGIN';
    }
});

pauseToggleBtn.addEventListener('click', (e) => {
    isPaused = !isPaused;
    if (isPaused) {
        targetRotateX = targetRotateY = currentRotateX = currentRotateY = spinYAngle = currentSpinYAngle = 0;
        targetGlintX = targetGlintY = currentGlintX = currentGlintY = 50;
        isFlipped = false;
        cardElement.classList.remove('is-login');
        spinTriggerBtn.textContent = 'LOGIN';
        cardElement.style.transform = 'rotateX(0deg) rotateY(0deg)';
        cardElement.style.setProperty('--glint-x', '50%');
        cardElement.style.setProperty('--glint-y', '50%');
        cardElement.style.setProperty('--border-glow-x', '50%');
        cardElement.style.setProperty('--border-glow-y', '50%');
        pauseToggleBtn.textContent = 'PLAY';
    } else {
        pauseToggleBtn.textContent = 'PAUSE';
    }
    e.stopPropagation();
});

spinTriggerBtn.addEventListener('click', (e) => {
    if (isPaused) return;
    isFlipped = !isFlipped;
    spinYAngle = isFlipped ? 180 : 0;
    targetRotateX = 0;
    targetRotateY = 0;
    targetGlintX = 50;
    targetGlintY = 50;
    cardElement.classList.toggle('is-login');
    spinTriggerBtn.textContent = isFlipped ? 'BACK' : 'LOGIN';
    e.stopPropagation();
});

function handleCardMove(clientX, clientY) {
    if (isPaused) return;
    const containerRect = cardContainer.getBoundingClientRect();
    
    if (isFlipped) {
        targetRotateX = 0;
        targetRotateY = 0;
    } else {
        const xFactor = ((clientX - containerRect.left) / containerRect.width) - 0.5;
        const yFactor = ((clientY - containerRect.top) / containerRect.height) - 0.5;
        targetRotateY = -xFactor * 30; 
        targetRotateX = yFactor * 10;
    }
    
    let percentX = ((clientX - containerRect.left) / containerRect.width) * 100;
    let percentY = ((clientY - containerRect.top) / containerRect.height) * 100;
    
    targetGlintX = isFlipped ? 100 - percentX : percentX;
    targetGlintY = percentY;

    clearTimeout(mouseStopTimer);
    mouseStopTimer = setTimeout(() => { 
        targetRotateX = 0; targetRotateY = 0; 
        targetGlintX = 50; targetGlintY = 50;
    }, 600);
}

cardContainer.addEventListener('mousemove', (e) => handleCardMove(e.clientX, e.clientY));
cardContainer.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) handleCardMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

cardContainer.addEventListener('mouseleave', () => { targetRotateX = 0; targetRotateY = 0; targetGlintX = 50; targetGlintY = 50; });
cardContainer.addEventListener('touchend', () => { targetRotateX = 0; targetRotateY = 0; targetGlintX = 50; targetGlintY = 50; });

function renderingAnimationLoop() {
    if (!isPaused) {
        currentRotateX += (targetRotateX - currentRotateX) * 0.04;
        currentRotateY += (targetRotateY - currentRotateY) * 0.04;
        currentSpinYAngle += (spinYAngle - currentSpinYAngle) * 0.04;
        
        cardElement.style.transform = 'rotateX(' + currentRotateX.toFixed(2) + 'deg) rotateY(' + (currentRotateY + currentSpinYAngle).toFixed(2) + 'deg)';
        
        currentGlintX += (targetGlintX - currentGlintX) * 0.04;
        currentGlintY += (targetGlintY - currentGlintY) * 0.04;
        
        cardElement.style.setProperty('--glint-x', currentGlintX.toFixed(2) + '%');
        cardElement.style.setProperty('--glint-y', currentGlintY.toFixed(2) + '%');
        cardElement.style.setProperty('--border-glow-x', currentGlintX.toFixed(2) + '%');
        cardElement.style.setProperty('--border-glow-y', currentGlintY.toFixed(2) + '%');
    }
    requestAnimationFrame(renderingAnimationLoop);
}
renderingAnimationLoop();