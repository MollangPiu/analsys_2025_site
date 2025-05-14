// 차트 색상 설정
const COLORS = {
    "음식·음료": '#FF3D7F',
    "여가·오락": '#3DFFF3',
    "유통": '#FFB800',
    "패션·뷰티": '#9D3DFF',
    "의료": '#3DFF8F'
};

let timeRange = 24; // 기본값: 24시간
let selectedRegion = 'all';
let selectedCategory = 'all';
let paymentChart = null;
let populationChart = null;

// 시간 범위 선택 이벤트 리스너
document.getElementById('timeRange').addEventListener('change', (e) => {
    timeRange = parseInt(e.target.value);
    fetchData();
});

// 지역 선택 이벤트 리스너
document.getElementById('areaSelector').addEventListener('change', (e) => {
    selectedRegion = e.target.value;
    fetchData();
});

// 데이터 가져오기
async function fetchData() {
    try {
        updateStatus('데이터를 불러오는 중...');
        
        // 결제 데이터 가져오기
        const paymentResponse = await fetch(`/api/data?hours=${timeRange}&region=${selectedRegion}&category=${selectedCategory}`);
        if (!paymentResponse.ok) throw new Error('결제 데이터를 가져오는데 실패했습니다');
        const paymentData = await paymentResponse.json();
        
        // 인구 통계 데이터 가져오기
        const populationResponse = await fetch('/api/population');
        if (!populationResponse.ok) throw new Error('인구 통계 데이터를 가져오는데 실패했습니다');
        const populationData = await populationResponse.json();
        
        console.log('인구 통계 데이터:', populationData);
        
        // 차트 업데이트
        updatePaymentChart(paymentData);
        updatePopulationChart(populationData);
        updatePopulationStats(populationData);
        
        updateStatus('마지막 업데이트: ' + new Date().toLocaleTimeString(), true);
    } catch (error) {
        console.error('데이터 가져오기 실패:', error);
        updateStatus('데이터를 가져오는데 실패했습니다', false);
    }
}

// 결제 차트 업데이트
function updatePaymentChart(data) {
    const canvas = document.getElementById('paymentChart');
    if (!canvas) return;

    const timeLabels = [...new Set(data.map(item => 
        formatTime(item.REG_DATE_HOUR, item.REG_DATE_MINUTE)
    ))].sort();

    const categories = [...new Set(data.map(item => item.RSB_LRG_CTGR))];
    const datasets = categories.map(category => {
        const categoryData = timeLabels.map(time => {
            const item = data.find(d => {
                const itemTime = formatTime(d.REG_DATE_HOUR, d.REG_DATE_MINUTE);
                return d.RSB_LRG_CTGR === category && itemTime === time;
            });
            return item ? item.MAX_AMT : 0;
        });

        return {
            label: category,
            data: categoryData,
            borderColor: COLORS[category],
            backgroundColor: COLORS[category] + '20',
            fill: true,
            tension: 0.4
        };
    });

    if (paymentChart) {
        paymentChart.destroy();
    }

    paymentChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '시간대별 결제금액 추이',
                    color: '#FFFFFF',
                    font: {
                        size: 16,
                        weight: 600
                    }
                },
                legend: {
                    position: 'right',
                    labels: {
                        color: '#FFFFFF',
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.parsed.y)}원`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#FFFFFF'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#FFFFFF',
                        callback: function(value) {
                            return formatNumber(value) + '원';
                        }
                    }
                }
            }
        }
    });
}

// 인구 통계 차트 업데이트
function updatePopulationChart(data) {
    const canvas = document.getElementById('populationChart');
    if (!canvas) return;

    console.log('인구 통계 차트 데이터:', data);

    const timeLabels = data.map(item => formatTime(item.REG_DATE_HOUR, 0));
    const datasets = [
        {
            label: '시간대별 인구수',
            data: data.map(item => Math.round(item.CNT)),
            borderColor: '#00fff2',
            backgroundColor: '#00fff220',
            fill: true,
            tension: 0.4
        }
    ];

    if (populationChart) {
        populationChart.destroy();
    }

    populationChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '시간대별 인구수 추이',
                    color: '#FFFFFF',
                    font: {
                        size: 16,
                        weight: 600
                    }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.parsed.y)}명`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#FFFFFF'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#FFFFFF',
                        callback: function(value) {
                            return formatNumber(value) + '명';
                        }
                    }
                }
            }
        }
    });
}

// 인구 통계 상태 업데이트
function updatePopulationStats(data) {
    if (data.length === 0) return;

    const latest = data[0];
    const currentPopulation = Math.round(latest.CNT);
    
    // 현재 인구수 업데이트
    const populationElement = document.getElementById('currentPopulation');
    if (populationElement) {
        populationElement.textContent = formatNumber(currentPopulation) + '명';
    }

    // 변화율 계산 및 업데이트
    if (data.length >= 2) {
        const previous = data[1];
        const previousPopulation = Math.round(previous.CNT);
        const change = ((currentPopulation - previousPopulation) / previousPopulation) * 100;
        
        const changeElement = document.getElementById('populationChange');
        if (changeElement) {
            changeElement.innerHTML = `
                <span>${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%</span>
                <span>지난 시간 대비</span>
            `;
            changeElement.className = `stat-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    }
}

// 숫자 포맷팅
function formatNumber(value) {
    return new Intl.NumberFormat('ko-KR').format(value);
}

// 시간 포맷팅
function formatTime(hour, minute) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// 상태 업데이트
function updateStatus(message, isOk = true) {
    const element = document.getElementById('updateStatus');
    if (element) {
        element.textContent = message;
        element.style.color = isOk ? 'var(--success)' : 'var(--danger)';
    }
}

// 현재 시간 업데이트
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const element = document.getElementById('currentTime');
    if (element) {
        element.textContent = timeString;
    }
}

// 1분마다 데이터 자동 업데이트
setInterval(fetchData, 60000);

// 1초마다 현재 시간 업데이트
setInterval(updateCurrentTime, 1000);

// 초기 데이터 로드
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    updateCurrentTime();
}); 