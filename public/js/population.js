let populationChart = null;

// 차트 색상 설정
const COLORS = {
    total: '#00fff2',
    male: '#3DFFF3',
    female: '#FF3D7F',
    age10: '#FFB800',
    age20: '#FF3D7F',
    age30: '#3DFFF3',
    age40: '#9D3DFF',
    age50: '#3DFF8F',
    age60: '#FFB800'
};

// 숫자 포맷팅
function formatNumber(value, type = 'number') {
    if (type === 'percent') {
        return new Intl.NumberFormat('ko-KR', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }).format(value / 100);
    }
    return new Intl.NumberFormat('ko-KR').format(value);
}

// 시간 포맷팅
function formatTime(hour, minute) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// 인구 통계 데이터 가져오기
export async function fetchPopulationData() {
    try {
        const response = await fetch('/api/population');
        if (!response.ok) throw new Error('인구 통계 데이터를 가져오는데 실패했습니다');
        const data = await response.json();
        updatePopulationChart(data);
        updatePopulationStats(data);
    } catch (error) {
        console.error('인구 통계 데이터 조회 실패:', error);
    }
}

// 인구 통계 차트 업데이트
function updatePopulationChart(data) {
    const canvas = document.getElementById('populationChart');
    if (!canvas) return;

    // 기존 차트 제거
    if (populationChart) {
        populationChart.destroy();
    }

    // 시간 레이블 생성
    const timeLabels = data.map(item => formatTime(item.REG_DATE_HOUR, item.REG_DATE_MINUTE));

    // 데이터셋 생성
    const datasets = [
        {
            label: '총 인구',
            data: data.map(item => Math.round((item.PPLTN_MIN + item.PPLTN_MAX) / 2)),
            borderColor: COLORS.total,
            backgroundColor: COLORS.total + '20',
            fill: true,
            tension: 0.4
        }
    ];

    // 차트 생성
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
                    position: 'top',
                    labels: {
                        color: '#FFFFFF',
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
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
    const currentPopulation = Math.round((latest.PPLTN_MIN + latest.PPLTN_MAX) / 2);
    
    // 현재 인구수 업데이트
    const populationElement = document.getElementById('currentPopulation');
    if (populationElement) {
        populationElement.textContent = formatNumber(currentPopulation) + '명';
    }

    // 변화율 계산 및 업데이트
    if (data.length >= 2) {
        const previous = data[1];
        const previousPopulation = Math.round((previous.PPLTN_MIN + previous.PPLTN_MAX) / 2);
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

// 차트 뷰 변경 이벤트 리스너
export function initPopulationControls() {
    const controls = document.querySelectorAll('.chart-control');
    controls.forEach(control => {
        control.addEventListener('click', () => {
            controls.forEach(c => c.classList.remove('active'));
            control.classList.add('active');
            fetchPopulationData();
        });
    });
} 