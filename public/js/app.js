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

// 시간 범위 선택 이벤트 리스너 (삭제)
// document.getElementById('timeRange').addEventListener('change', (e) => {
//     timeRange = parseInt(e.target.value);
//     fetchData();
// });

// 지역 선택 이벤트 리스너 (삭제)
// document.getElementById('areaSelector').addEventListener('change', (e) => {
//     selectedRegion = e.target.value;
//     fetchData();
// });

// 데이터 가져오기
async function fetchData() {
    try {
        updateStatus('데이터를 불러오는 중...');
        
        // 결제 데이터 가져오기
        const paymentResponse = await fetch(`/api/data?hours=${timeRange}&region=${selectedRegion}&category=${selectedCategory}`);
        if (!paymentResponse.ok) throw new Error('결제 데이터를 가져오는데 실패했습니다');
        const paymentData = await paymentResponse.json();
        console.log('--- DEBUG: /api/data 응답 (결제 데이터): ---', JSON.parse(JSON.stringify(paymentData)));
        
        // 인구 통계 데이터 가져오기 (index.html의 차트 및 카드용)
        const populationResponse = await fetch('/api/main-page-hourly-population');
        if (!populationResponse.ok) throw new Error('인구 통계 데이터를 가져오는데 실패했습니다 (메인 페이지용)');
        const populationDataForStatsAndChart = await populationResponse.json();
        console.log('--- DEBUG: /api/main-page-hourly-population 응답 (인구 통계 데이터): ---', JSON.parse(JSON.stringify(populationDataForStatsAndChart)));
        
        // 차트 업데이트
        updatePaymentChart(paymentData);
        updatePopulationChart(populationDataForStatsAndChart);
        updatePopulationStats(populationDataForStatsAndChart);
        
        updateStatus('마지막 업데이트: ' + new Date().toLocaleTimeString(), true);
    } catch (error) {
        console.error('데이터 가져오기 실패:', error);
        updateStatus('데이터를 가져오는데 실패했습니다', false);
    }
}

// 결제 통계 업데이트
function updatePaymentStats(data) {
    if (data.length === 0) return;

    // 모든 카테고리의 최대 결제금액 찾기
    const maxAmount = Math.max(...data.map(item => item.MAX_AMT));
    
    // 최대 결제금액 업데이트
    const maxPaymentElement = document.getElementById('maxPayment');
    if (maxPaymentElement) {
        maxPaymentElement.textContent = formatNumber(maxAmount) + '원';
    }

    // 이전 시간대와 비교하여 변화율 계산
    const latestHour = Math.max(...data.map(item => item.REG_DATE_HOUR));
    const currentHourData = data.filter(item => item.REG_DATE_HOUR === latestHour);
    const previousHourData = data.filter(item => item.REG_DATE_HOUR === latestHour - 1);

    if (currentHourData.length > 0 && previousHourData.length > 0) {
        const currentMax = Math.max(...currentHourData.map(item => item.MAX_AMT));
        const previousMax = Math.max(...previousHourData.map(item => item.MAX_AMT));
        const change = ((currentMax - previousMax) / previousMax) * 100;

        const changeElement = document.getElementById('paymentChange');
        if (changeElement) {
            changeElement.innerHTML = `
                <span>${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%</span>
                <span>지난 시간 대비</span>
            `;
            changeElement.className = `stat-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    }
}

// 결제 차트 업데이트
function updatePaymentChart(data) {
    const canvas = document.getElementById('paymentChart');
    if (!canvas) return;

    // 데이터를 날짜와 시간으로 정렬
    const sortedData = [...data].sort((a, b) => {
        const aTime = `${a.REG_DATE} ${String(a.REG_DATE_HOUR).padStart(2, '0')}:${String(a.REG_DATE_MINUTE).padStart(2, '0')}`;
        const bTime = `${b.REG_DATE} ${String(b.REG_DATE_HOUR).padStart(2, '0')}:${String(b.REG_DATE_MINUTE).padStart(2, '0')}`;
        return new Date(bTime) - new Date(aTime);
    });

    // 최대 결제금액 통계 업데이트
    updatePaymentStats(sortedData);

    const timeLabels = [...new Set(sortedData.map(item => 
        formatTime(item.REG_DATE_HOUR, item.REG_DATE_MINUTE)
    ))];

    const categories = [...new Set(sortedData.map(item => item.RSB_LRG_CTGR))];
    const datasets = categories.map(category => {
        const categoryData = timeLabels.map(time => {
            const item = sortedData.find(d => {
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
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.parsed.y)}원`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    reverse: true,
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
    if (!canvas) {
        console.error('[updatePopulationChart] 인구 통계 차트의 canvas 요소를 찾을 수 없습니다!');
        return;
    }

    if (populationChart) {
        populationChart.destroy(); // 기존 차트가 있으면 파괴
        populationChart = null;
    }

    if (!data || data.length === 0) {
        console.warn('[updatePopulationChart] 인구 통계 데이터가 없거나 비어있습니다. 차트를 비웁니다.');
        // 데이터가 없으면 빈 차트를 표시하거나, 사용자에게 메시지를 보여줄 수 있습니다.
        // 여기서는 간단히 빈 차트 상태로 둡니다.
        populationChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '시간대별 인구수',
                    data: [],
                    borderColor: '#00fff2',
                    backgroundColor: '#00fff220',
                    fill: true,
                    tension: 0.1 // 약간의 곡선
                }]
            },
            options: getDefaultChartOptions('시간대별 인구수 추이 (평균)', value => formatNumber(value))
        });
        return;
    }

    // 데이터는 최신 시간이 먼저 오므로, 차트 표시를 위해 순서를 뒤집습니다.
    const reversedData = [...data].reverse();

    const timeLabels = reversedData.map(item => {
        // REG_DATE_HOUR가 숫자 형태라고 가정합니다.
        return String(item.REG_DATE_HOUR).padStart(2, '0') + ':00';
    });
    
    const chartDataValues = reversedData.map(item => {
        let countValue = item.CNT; // 기본적으로 CNT (대문자)를 기대
        if (typeof countValue === 'undefined') {
            countValue = item.cnt; // CNT가 없으면 cnt (소문자) 시도
        }

        const floatVal = parseFloat(countValue);
        return Number.isNaN(floatVal) ? 0 : Math.round(floatVal);
    });

    console.log('[updatePopulationChart] Time Labels:', timeLabels);
    console.log('[updatePopulationChart] Chart Data Values:', chartDataValues);

    populationChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: '평균 인구수', // 범례 레이블 변경
                    data: chartDataValues,
                    borderColor: '#00fff2',
                    backgroundColor: '#00fff220', // 투명도 조정 가능
                    fill: true,
                    tension: 0.1, // 약간의 곡선, 0.4는 너무 큼
                    pointRadius: 3, // 데이터 포인트 크기
                    pointHoverRadius: 5 // 호버시 포인트 크기
                }
            ]
        },
        options: getDefaultChartOptions('시간대별 인구수 추이 (평균)', value => formatNumber(value))
    });
}

// 기본 차트 옵션을 생성하는 헬퍼 함수
function getDefaultChartOptions(titleText, yTicksCallback) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: titleText,
                color: '#FFFFFF',
                font: {
                    size: 16,
                    weight: '600'
                }
            },
            legend: {
                position: 'top', // 범례 위치 변경
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
                        return `${context.dataset.label}: ${formatNumber(context.parsed.y)}`;
                    }
                }
            }
        },
        scales: {
            x: {
                // reverse: false, // 데이터 자체를 뒤집었으므로 false
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
                    callback: yTicksCallback // 콜백 함수 사용
                }
            }
        }
    };
}

// 인구 통계 상태 업데이트
function updatePopulationStats(data) {
    const currentPopulationElement = document.getElementById('currentPopulation');
    const populationChangeElement = document.getElementById('populationChange');

    function changeElement(element, value, changePercent) {
      if (element) {
        element.innerHTML = `
          <span>${value}</span>
          ${changePercent !== null ? `<span class="stat-change ${changePercent >= 0 ? 'positive' : 'negative'}">${changePercent >= 0 ? '▲' : '▼'} ${Math.abs(changePercent).toFixed(1)}%</span>` : ''}
        `;
      }
    }

    if (!data || data.length === 0) {
        if (currentPopulationElement) currentPopulationElement.textContent = 'N/A';
        if (populationChangeElement) populationChangeElement.innerHTML = '<span>데이터 없음</span>';
        console.warn('[updatePopulationStats] 인구 통계 데이터가 없어 숫자 업데이트 불가.');
        return;
    }

    // 데이터는 최신 시간이 배열의 처음 (data[0])
    // 현재 인구수 (가장 최신 데이터의 CNT 값)
    let currentPop = 0;
    if (data[0]) {
        const latestDataPoint = data[0];
        let countValue = latestDataPoint.CNT;
        if (typeof countValue === 'undefined') {
            countValue = latestDataPoint.cnt;
        }
        const floatVal = parseFloat(countValue);
        currentPop = Number.isNaN(floatVal) ? 0 : Math.round(floatVal);
    }
    
    if (currentPopulationElement) {
        currentPopulationElement.textContent = formatNumber(currentPop);
    }
    console.log(`[updatePopulationStats] 현재 인구수 카드 업데이트: ${formatNumber(currentPop)}`);

    // 변화율 계산 (예: 현재 값과 그 이전 값 비교)
    let previousPop = 0;
    let changePercent = null;

    if (data.length > 1) {
        const previousDataPoint = data[1]; // 그 다음 최신 데이터
        let countValuePrev = previousDataPoint.CNT;
        if (typeof countValuePrev === 'undefined') {
            countValuePrev = previousDataPoint.cnt;
        }
        const floatValPrev = parseFloat(countValuePrev);
        previousPop = Number.isNaN(floatValPrev) ? 0 : Math.round(floatValPrev);

        if (previousPop !== 0) { // 0으로 나누는 것 방지
            changePercent = ((currentPop - previousPop) / previousPop) * 100;
        } else if (currentPop > 0) { // 이전이 0인데 현재 0보다 크면 무한대 증가 대신 100%로 표시 (혹은 다른 방식)
            changePercent = 100.0; 
        }
    }
    
    if (populationChangeElement) {
        if (changePercent !== null) {
            populationChangeElement.innerHTML = `
                <span>${changePercent >= 0 ? '▲' : '▼'} ${Math.abs(changePercent).toFixed(1)}%</span>
                <span>이전 시간 대비</span>
            `;
            populationChangeElement.className = `stat-change ${changePercent >= 0 ? 'positive' : 'negative'}`;
        } else {
            populationChangeElement.innerHTML = '<span>변화율 계산 불가</span>';
            populationChangeElement.className = 'stat-change';
        }
        console.log(`[updatePopulationStats] 인구 변화율 업데이트: ${changePercent !== null ? changePercent.toFixed(1) + '%' : 'N/A'}`);
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