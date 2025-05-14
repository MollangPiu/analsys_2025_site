// Global chart instances
let timeSeriesChart = null;
let areaChart = null;

// Global state
let selectedArea = 'all';

// Chart colors for different areas
const AREA_COLORS = {
    '강남 MICE 관광특구': {
        border: 'rgb(255, 99, 132)',
        background: 'rgba(255, 99, 132, 0.1)'
    },
    '동대문 관광특구': {
        border: 'rgb(54, 162, 235)',
        background: 'rgba(54, 162, 235, 0.1)'
    },
    '명동 관광특구': {
        border: 'rgb(255, 206, 86)',
        background: 'rgba(255, 206, 86, 0.1)'
    },
    '이태원 관광특구': {
        border: 'rgb(75, 192, 192)',
        background: 'rgba(75, 192, 192, 0.1)'
    },
    '홍대 관광특구': {
        border: 'rgb(153, 102, 255)',
        background: 'rgba(153, 102, 255, 0.1)'
    },
    '광화문·덕수궁': {
        border: 'rgb(255, 159, 64)',
        background: 'rgba(255, 159, 64, 0.1)'
    },
    '관악 관광특구': {
        border: 'rgb(231, 233, 237)',
        background: 'rgba(231, 233, 237, 0.1)'
    },
    '잠실 관광특구': {
        border: 'rgb(102, 255, 102)',
        background: 'rgba(102, 255, 102, 0.1)'
    }
};

// Chart colors
const CHART_COLORS = {
    primary: 'rgb(75, 192, 192)',
    secondary: 'rgb(255, 99, 132)',
    background: 'rgba(75, 192, 192, 0.1)'
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('앱 초기화 시작');
    if (typeof Chart === 'undefined') {
        console.error('Chart.js를 찾을 수 없습니다!');
        return;
    }

    initializeControls();
    loadAreas();
    updateCharts();
    // Update charts every 5 minutes
    setInterval(updateCharts, 5 * 60 * 1000);
});

// Initialize control event listeners
function initializeControls() {
    // Area selector
    document.getElementById('areaSelector').addEventListener('change', (e) => {
        selectedArea = e.target.value;
        updateCharts();
    });
}

// Load area options
async function loadAreas() {
    try {
        const response = await fetch('/api/areas');
        const areas = await response.json();
        
        const selector = document.getElementById('areaSelector');
        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area.AREA_NM;
            option.textContent = area.AREA_NM;
            selector.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading areas:', error);
        showError('지역 목록을 불러오는데 실패했습니다.');
    }
}

// Update all charts
async function updateCharts() {
    try {
        const response = await fetch('/api/population/detail');
        const data = await response.json();
        
        if (!data || !data.totalData || !data.areaData) {
            throw new Error('Invalid data format received');
        }

        console.log('서버 응답 데이터:', {
            totalData: data.totalData.length,
            areaData: data.areaData.length,
            sample: data.totalData[0]
        });

        updateTimeSeriesChart(data.totalData);
        updateAreaChart(data.areaData);
    } catch (error) {
        console.error('Error updating charts:', error);
        showError('데이터를 불러오는데 실패했습니다.');
    }
}

// Update time series chart
function updateTimeSeriesChart(data) {
    const canvas = document.getElementById('timeSeriesChart');
    if (!canvas) {
        console.error('차트 캔버스를 찾을 수 없습니다');
        return;
    }

    // 기존 차트 제거
    if (timeSeriesChart) {
        timeSeriesChart.destroy();
        timeSeriesChart = null;
    }

    // 시간별 데이터 그룹화
    const hourlyData = {};
    const areaData = {};

    // 각 지역별 데이터 초기화
    Object.keys(AREA_COLORS).forEach(area => {
        areaData[area] = {};
    });

    // 데이터 처리
    data.forEach(item => {
        const date = new Date(item.DATE);
        date.setHours(parseInt(item.HOUR), 0, 0, 0); // 시간별로 그룹화
        const timeKey = date.toISOString();

        if (!hourlyData[timeKey]) {
            hourlyData[timeKey] = {
                date: date,
                hour: parseInt(item.HOUR)
            };
        }

        if (!areaData[item.AREA_NM][timeKey]) {
            areaData[item.AREA_NM][timeKey] = {
                sum: 0,
                count: 0
            };
        }

        const value = (parseFloat(item.AVG_PPLTN_MIN) + parseFloat(item.AVG_PPLTN_MAX)) / 2;
        areaData[item.AREA_NM][timeKey].sum += value;
        areaData[item.AREA_NM][timeKey].count += 1;
    });

    // 시간 레이블 생성 (정렬된)
    const timeLabels = Object.keys(hourlyData).sort();

    // 데이터셋 생성
    const datasets = [];
    
    if (selectedArea === 'all') {
        // 각 지역별 데이터셋 생성
        Object.keys(AREA_COLORS).forEach(area => {
            const areaValues = timeLabels.map(timeKey => {
                const hourData = areaData[area][timeKey];
                return hourData ? Math.round(hourData.sum / hourData.count) : null;
            });

            // null이 아닌 데이터가 있는 경우에만 데이터셋 추가
            if (areaValues.some(value => value !== null)) {
                datasets.push({
                    label: area,
                    data: areaValues,
                    borderColor: AREA_COLORS[area].border,
                    backgroundColor: AREA_COLORS[area].background,
                    fill: false,
                    tension: 0.1
                });
            }
        });
    } else {
        // 선택된 지역만 표시
        const areaValues = timeLabels.map(timeKey => {
            const hourData = areaData[selectedArea][timeKey];
            return hourData ? Math.round(hourData.sum / hourData.count) : null;
        });

        datasets.push({
            label: selectedArea,
            data: areaValues,
            borderColor: AREA_COLORS[selectedArea].border,
            backgroundColor: AREA_COLORS[selectedArea].background,
            fill: true,
            tension: 0.1
        });
    }

    // 차트 생성
    timeSeriesChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: timeLabels.map(timeKey => {
                const date = new Date(timeKey);
                return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:00`;
            }),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: selectedArea === 'all' ? '지역별 시간당 인구 변화' : `${selectedArea} 시간당 인구 변화`
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                legend: {
                    display: selectedArea === 'all',
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '시간'
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '인구 수'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Update area chart
function updateAreaChart(data) {
    try {
        const canvas = document.getElementById('areaChart');
        if (!canvas) {
            throw new Error('차트 캔버스를 찾을 수 없습니다');
        }

        // 기존 차트 제거
        if (areaChart) {
            areaChart.destroy();
            areaChart = null;
        }

        // 최신 데이터만 사용
        const latestData = {};
        data.forEach(item => {
            const datePart = item.DATE.split('T')[0];
            const itemDate = new Date(datePart);
            itemDate.setHours(parseInt(item.HOUR), parseInt(item.MINUTE), 0);
            
            if (!latestData[item.AREA_NM] || itemDate > new Date(latestData[item.AREA_NM].date)) {
                latestData[item.AREA_NM] = {
                    date: datePart,
                    value: Math.round((parseFloat(item.AVG_PPLTN_MIN) + parseFloat(item.AVG_PPLTN_MAX)) / 2)
                };
            }
        });

        // 차트 생성
        areaChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: Object.keys(latestData),
                datasets: [{
                    label: '현재 인구',
                    data: Object.values(latestData).map(item => item.value),
                    backgroundColor: 'rgb(75, 192, 192)',
                    borderColor: 'white',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '지역별 현재 인구 비교'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '인구 수'
                        }
                    }
                }
            }
        });

        console.log('지역별 차트 생성 완료');
    } catch (error) {
        console.error('지역별 차트 생성 중 오류:', error);
    }
}

// Error handling
function showError(message) {
    console.error(message);
}

