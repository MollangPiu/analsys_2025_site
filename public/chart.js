async function drawChart() {
    try {
      const res = await fetch('/api/data');
      const data = await res.json();
  
      if (!data.length) {
        document.body.innerHTML += '<p>📭 데이터가 없습니다.</p>';
        return;
      }
  
      // 날짜 + 시간 형식 라벨 ('YYYY-MM-DD HH시')
      const labelsSet = new Set(
        data.map(d => {
          const dateStr = d.REG_DATE.split('T')[0];  // '2025-05-13'
          return `${dateStr} ${String(d.REG_DATE_HOUR).padStart(2, '0')}시`;
        })
      );
      const labels = Array.from(labelsSet).sort();
  
      // 카테고리별 그룹화
      const grouped = {};
      data.forEach(d => {
        const dateStr = d.REG_DATE.split('T')[0];
        const label = `${dateStr} ${String(d.REG_DATE_HOUR).padStart(2, '0')}시`;
  
        if (!grouped[d.RSB_LRG_CTGR]) {
          grouped[d.RSB_LRG_CTGR] = {};
        }
        grouped[d.RSB_LRG_CTGR][label] = d.MAX_AMT;
      });
  
      // 색상 팔레트
      const colors = [
        'red', 'blue', 'green', 'orange', 'purple',
        'brown', 'teal', 'gold', 'black', 'pink'
      ];
  
      const datasets = Object.keys(grouped).map((category, idx) => {
        const dataPoints = grouped[category];
        return {
          label: category,
          data: labels.map(label => dataPoints[label] ?? null),
          fill: false,
          borderColor: colors[idx % colors.length],
          tension: 0.2
        };
      });
  
      const ctx = document.getElementById('myChart').getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets
        },
        options: {
          responsive: true,
          interaction: {
            mode: 'index',
            intersect: false
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: '최대 결제액 (₩)' }
            },
            x: {
              title: { display: true, text: '시간' }
            }
          },
          plugins: {
            title: {
              display: true,
              text: '카테고리별 최대 결제액 추이 (최근 24시간)'
            },
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    } catch (err) {
      console.error('데이터 가져오기 실패:', err);
      document.body.innerHTML += '<p>❌ 데이터 불러오기 실패</p>';
    }
  }
  
  drawChart();
  