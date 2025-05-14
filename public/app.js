// 차트 인스턴스
let chart = null;

// 전역 상태
let selectedArea = 'all';
let lastData = null;

// 차트 색상
const COLORS = {
    "음식·음료": '#FF3D7F',
    "여가·오락": '#3DFFF3',
    "유통": '#FFB800',
    "패션·뷰티": '#9D3DFF',
    "의료": '#3DFF8F'
};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('대시보드 초기화');
    initializeControls();
    updateDashboard();
    updateCurrentTime();
    
    // 5분마다 데이터 업데이트
    setInterval(updateDashboard, 5 * 60 * 1000);
    // 1초마다 현재 시간 업데이트
    setInterval(updateCurrentTime, 1000);
});

// 현재 시간 업데이트
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('currentTime').textContent = timeString;
}

// 컨트롤 초기화
function initializeControls() {
    const areaSelector = document.getElementById('areaSelector');
    if (!areaSelector) {
        console.error('areaSelector를 찾을 수 없습니다');
        return;
    }
    
    areaSelector.addEventListener('change', (e) => {
        selectedArea = e.target.value;
        updateDashboard();
    });
}

// 대시보드 업데이트
async function updateDashboard() {
    try {
        const response = await fetch(`/api/data`);
        const data = await response.json();
        
        if (!data || data.length === 0) {
            console.error('데이터가 비어있습니다');
            updateStatus('오류', false);
            return;
        }

        console.log('수신된 데이터:', data);
        lastData = data;
        
        updateChart(data);
        updateStats(data);
        updateStatus('정상', true);
    } catch (error) {
        console.error('Error updating dashboard:', error);
        updateStatus('오류', false);
    }
}

// 상태 업데이트
function updateStatus(status, isOk) {
    const statusElement = document.getElementById('updateStatus');
    statusElement.textContent = status;
    statusElement.style.color = isOk ? 'var(--success)' : 'var(--danger)';
}

// 통계 업데이트
function updateStats(data) {
    // 최대 결제금액 계산
    const maxAmount = Math.max(...data.map(item => item.MAX_AMT));
    const maxPaymentElement = document.getElementById('maxPayment');
    maxPaymentElement.textContent = new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW'
    }).format(maxAmount);

    // 변화율 계산 (첫 번째와 두 번째 데이터 비교)
    if (data.length >= 2) {
        const latest = data[0].MAX_AMT;
        const previous = data[1].MAX_AMT;
        const change = ((latest - previous) / previous) * 100;
        
        const changeElement = document.getElementById('paymentChange');
        changeElement.innerHTML = `
            <span>${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%</span>
            <span>지난 시간 대비</span>
        `;
        changeElement.className = `stat-change ${change >= 0 ? 'positive' : 'negative'}`;
    }
}

// 차트 업데이트
function updateChart(data) {
    const canvas = document.getElementById('paymentChart');
    if (!canvas) {
        console.error('차트 캔버스를 찾을 수 없습니다');
        return;
    }

    // 기존 차트 제거
    if (chart) {
        chart.destroy();
    }

    // 데이터 처리
    const timeLabels = [...new Set(data.map(item => 
        `${String(item.REG_DATE_HOUR).padStart(2, '0')}:${String(item.REG_DATE_MINUTE).padStart(2, '0')}`
    ))].sort();

    const categories = [...new Set(data.map(item => item.RSB_LRG_CTGR))];
    const datasets = categories.map(category => {
        const categoryData = timeLabels.map(time => {
            const item = data.find(d => {
                const itemTime = `${String(d.REG_DATE_HOUR).padStart(2, '0')}:${String(d.REG_DATE_MINUTE).padStart(2, '0')}`;
                return d.RSB_LRG_CTGR === category && itemTime === time;
            });
            return item ? item.MAX_AMT : 0;
        });

        return {
            label: category,
            data: categoryData,
            borderColor: COLORS[category],
            backgroundColor: COLORS[category] + '10',
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: COLORS[category],
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointShadowBlur: 10,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: '#FFFFFF',
            pointHoverBorderColor: COLORS[category]
        };
    });

    // 차트 생성
    chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                title: {
                    display: true,
                    text: '카테고리별 시간당 최대 결제금액',
                    color: '#FFFFFF',
                    font: {
                        size: 16,
                        weight: 600
                    },
                    padding: 20
                },
                legend: {
                    position: 'right',
                    labels: {
                        color: '#FFFFFF',
                        font: {
                            size: 13,
                            weight: 500
                        },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 15
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(10, 11, 30, 0.95)',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
                    borderColor: 'rgba(30, 167, 253, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    bodyFont: {
                        weight: 500
                    },
                    titleFont: {
                        weight: 600
                    },
                    displayColors: true,
                    boxPadding: 5,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('ko-KR', {
                                    style: 'currency',
                                    currency: 'KRW'
                                }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(30, 167, 253, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#FFFFFF',
                        font: {
                            weight: 500
                        },
                        padding: 10
                    },
                    title: {
                        display: true,
                        text: '시간',
                        color: '#FFFFFF',
                        font: {
                            weight: 600
                        },
                        padding: 10
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(30, 167, 253, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#FFFFFF',
                        font: {
                            weight: 500
                        },
                        padding: 10,
                        callback: function(value) {
                            return new Intl.NumberFormat('ko-KR', {
                                style: 'currency',
                                currency: 'KRW',
                                notation: 'compact',
                                compactDisplay: 'short'
                            }).format(value);
                        }
                    },
                    title: {
                        display: true,
                        text: '결제금액 (원)',
                        color: '#FFFFFF',
                        font: {
                            weight: 600
                        },
                        padding: 10
                    }
                }
            }
        }
    });
} 