<script setup lang="ts">
/**
 * 使用统计页面
 *
 * @author zhuhx
 */
import { ref, onMounted, watch } from 'vue'
import * as echarts from 'echarts'
import { getStatsOverview, getUsageTrends, getTopAgents, getAgentTrends } from '@/api/stats'
import type { StatsOverview, UsageTrend, AgentUsageRank, AgentUsageTrend } from '@/types/stats'

// 日期范围
const dateRange = ref<[Date, Date] | null>(null)

// 数据状态
const loading = ref(false)
const overview = ref<StatsOverview | null>(null)
const trends = ref<UsageTrend[]>([])
const agentTrends = ref<AgentUsageTrend[]>([])
const topAgents = ref<AgentUsageRank[]>([])

// 图表实例
let chartInstance: echarts.ECharts | null = null
const chartRef = ref<HTMLDivElement | null>(null)

// 格式化日期为 yyyy-MM-dd
const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取查询参数
const getQueryParams = () => {
  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    return {
      startDate: formatDate(dateRange.value[0]),
      endDate: formatDate(dateRange.value[1])
    }
  }
  // 默认最近14天
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 14)
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  }
}

// 加载使用统计概览
const loadOverview = async () => {
  try {
    const params = getQueryParams()
    overview.value = await getStatsOverview(params)
  } catch (error) {
    console.error('加载使用统计概览失败:', error)
  }
}

// 加载使用趋势
const loadTrends = async () => {
  try {
    const params = getQueryParams()
    const [trendsData, agentTrendsData] = await Promise.all([
      getUsageTrends(params),
      getAgentTrends(params)
    ])
    trends.value = trendsData
    agentTrends.value = agentTrendsData
    renderChart()
  } catch (error) {
    console.error('加载使用趋势失败:', error)
  }
}

// 加载 TOP Agent
const loadTopAgents = async () => {
  try {
    const params = { ...getQueryParams(), limit: 10 }
    topAgents.value = await getTopAgents(params)
  } catch (error) {
    console.error('加载TOP Agent失败:', error)
  }
}

// 加载所有数据
const loadAllData = async () => {
  loading.value = true
  try {
    await Promise.all([
      loadOverview(),
      loadTrends(),
      loadTopAgents()
    ])
  } finally {
    loading.value = false
  }
}

// 渲染图表
const renderChart = () => {
  if (!chartRef.value) return

  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  // 从agentTrends中提取数据
  const dates = [...new Set(agentTrends.value.map((item: AgentUsageTrend) => item.date))].sort()
  const agents = [...new Set(agentTrends.value.map((item: AgentUsageTrend) => item.agentName))]

  // 为每个Agent分配颜色
  const colorPalette = [
    '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
    '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'
  ]

  // 构建每个Agent的Token和API Calls数据
  const tokenSeriesMap = new Map<string, number[]>()
  const apiCallsSeriesMap = new Map<string, number[]>()

  agents.forEach(agent => {
    tokenSeriesMap.set(agent, new Array(dates.length).fill(0))
    apiCallsSeriesMap.set(agent, new Array(dates.length).fill(0))
  })

  agentTrends.value.forEach((trend: AgentUsageTrend) => {
    const dateIndex = dates.indexOf(trend.date)
    if (dateIndex !== -1) {
      const tokenData = tokenSeriesMap.get(trend.agentName)
      const apiCallsData = apiCallsSeriesMap.get(trend.agentName)
      if (tokenData) tokenData[dateIndex] = trend.totalTokens
      if (apiCallsData) apiCallsData[dateIndex] = trend.apiCalls
    }
  })

  // 从trends中获取RPM数据
  const avgRpm = trends.value.map(item => item.averageRpm || 0)
  const peakRpm = trends.value.map(item => item.peakRpm || 0)

  // 构建系列数据
  const series: any[] = []

  // 添加Token堆叠柱状图系列（所有Agent共享"Token 使用量"图例）
  agents.forEach((agent, index) => {
    series.push({
      name: 'Token 使用量',
      type: 'bar',
      stack: 'token',
      data: tokenSeriesMap.get(agent),
      itemStyle: {
        color: colorPalette[index % colorPalette.length]
      },
      emphasis: {
        focus: 'series'
      },
      // 自定义tooltip显示Agent名称
      agentName: agent
    })
  })

  // 添加API Calls堆叠柱状图系列（所有Agent共享"调用次数"图例）
  agents.forEach((agent, index) => {
    series.push({
      name: '调用次数',
      type: 'bar',
      stack: 'apiCalls',
      data: apiCallsSeriesMap.get(agent),
      itemStyle: {
        color: colorPalette[index % colorPalette.length]
      },
      emphasis: {
        focus: 'series'
      },
      // 自定义tooltip显示Agent名称
      agentName: agent
    })
  })

  // 添加RPM折线图系列
  series.push(
    {
      name: '平均 RPM',
      type: 'line',
      smooth: true,
      yAxisIndex: 1,
      data: avgRpm,
      itemStyle: {
        color: '#e6a23c'
      }
    },
    {
      name: '峰值 RPM',
      type: 'line',
      smooth: true,
      yAxisIndex: 1,
      data: peakRpm,
      itemStyle: {
        color: '#f56c6c'
      },
      lineStyle: {
        type: 'dashed'
      }
    }
  )

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return ''

        let result = `${params[0].axisValue}<br/>`

        // 按系列类型分组显示
        const tokenItems = params.filter((p: any) => p.seriesName === 'Token 使用量')
        const apiCallsItems = params.filter((p: any) => p.seriesName === '调用次数')
        const rpmItems = params.filter((p: any) => p.seriesName.includes('RPM'))

        if (tokenItems.length > 0) {
          result += '<br/><b>Token 使用量:</b><br/>'
          tokenItems.forEach((item: any) => {
            const agentName = series[item.seriesIndex].agentName || '未知'
            result += `${item.marker} ${agentName}: ${item.value.toLocaleString()}<br/>`
          })
        }

        if (apiCallsItems.length > 0) {
          result += '<br/><b>调用次数:</b><br/>'
          apiCallsItems.forEach((item: any) => {
            const agentName = series[item.seriesIndex].agentName || '未知'
            result += `${item.marker} ${agentName}: ${item.value.toLocaleString()}<br/>`
          })
        }

        if (rpmItems.length > 0) {
          result += '<br/>'
          rpmItems.forEach((item: any) => {
            result += `${item.marker} ${item.seriesName}: ${formatRpm(item.value)}<br/>`
          })
        }

        return result
      }
    },
    legend: {
      data: ['Token 使用量', '调用次数', '平均 RPM', '峰值 RPM'],
      selected: {
        'Token 使用量': true,
        '调用次数': false,
        '平均 RPM': false,
        '峰值 RPM': true
      },
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: dates
    },
    yAxis: [
      {
        type: 'value',
        name: 'Token/调用次数',
        position: 'left',
        axisLabel: {
          formatter: (value: number) => {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'
            if (value >= 1000) return (value / 1000).toFixed(1) + 'K'
            return value.toString()
          }
        }
      },
      {
        type: 'value',
        name: 'RPM',
        position: 'right',
        axisLabel: {
          formatter: '{value}'
        }
      }
    ],
    series
  }

  chartInstance.setOption(option)

  // 移除旧的事件监听器
  chartInstance.off('legendselectchanged')

  // 监听图例选择变化事件，处理指标互斥
  chartInstance.on('legendselectchanged', (params: any) => {
    const clickedName = params.name
    const isSelected = params.selected[clickedName]

    // 如果用户选中了某个指标
    if (isSelected) {
      const newSelected = { ...params.selected }
      let needUpdate = false

      // 定义左轴和右轴的指标
      const leftAxisSeries = ['Token 使用量', '调用次数']
      const rightAxisSeries = ['平均 RPM', '峰值 RPM']

      // 处理左轴指标的互斥
      if (leftAxisSeries.includes(clickedName)) {
        leftAxisSeries.forEach(name => {
          if (name !== clickedName && newSelected[name]) {
            newSelected[name] = false
            needUpdate = true
          }
        })
      }

      // 处理右轴指标的互斥
      if (rightAxisSeries.includes(clickedName)) {
        rightAxisSeries.forEach(name => {
          if (name !== clickedName && newSelected[name]) {
            newSelected[name] = false
            needUpdate = true
          }
        })
      }

      if (needUpdate) {
        chartInstance?.setOption({
          legend: { selected: newSelected }
        })
      }
    }
  })
}

// 格式化数字
const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K'
  return num.toLocaleString()
}

// 格式化RPM
const formatRpm = (rpm: number): string => {
  if (rpm >= 1) {
    return rpm.toFixed(1)
  } else if (rpm >= 0.01) {
    return rpm.toFixed(2)
  } else if (rpm > 0) {
    return rpm.toFixed(3)
  }
  return '0'
}

// 监听日期范围变化
watch(dateRange, () => {
  loadOverview()
  loadTrends()
  loadTopAgents()
})

// 窗口大小变化时重新渲染图表
const handleResize = () => {
  chartInstance?.resize()
}

onMounted(() => {
  // 设置默认日期范围为最近14天
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 14)
  dateRange.value = [startDate, endDate]

  loadAllData()
  window.addEventListener('resize', handleResize)
})
</script>

<template>
  <div class="stats-page" v-loading="loading">
    <!-- 使用统计概览卡片 -->
    <el-row :gutter="20" class="overview-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="overview-card" shadow="hover">
          <div class="overview-icon" style="background: linear-gradient(135deg, #67c23a, #85ce61)">
            <el-icon size="24"><Coin /></el-icon>
          </div>
          <div class="overview-content">
            <div class="overview-label">总 Token</div>
            <div class="overview-value">{{ formatNumber(overview?.totalTokens || 0) }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="overview-card" shadow="hover">
          <div class="overview-icon" style="background: linear-gradient(135deg, #409eff, #66b1ff)">
            <el-icon size="24"><Connection /></el-icon>
          </div>
          <div class="overview-content">
            <div class="overview-label">总调用次数</div>
            <div class="overview-value">{{ formatNumber(overview?.totalCalls || 0) }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="overview-card" shadow="hover">
          <div class="overview-icon" style="background: linear-gradient(135deg, #e6a23c, #f0c78a)">
            <el-icon size="24"><TrendCharts /></el-icon>
          </div>
          <div class="overview-content">
            <div class="overview-label">平均 RPM</div>
            <div class="overview-value">{{ formatRpm(overview?.averageRpm || 0) }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="overview-card" shadow="hover">
          <div class="overview-icon" style="background: linear-gradient(135deg, #f56c6c, #f89898)">
            <el-icon size="24"><Lightning /></el-icon>
          </div>
          <div class="overview-content">
            <div class="overview-label">峰值 RPM</div>
            <div class="overview-value">{{ overview?.peakRpm || 0 }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 使用趋势图表 -->
    <el-card class="chart-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>使用趋势</span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            size="default"
            :shortcuts="[
              { text: '最近7天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 7); return [start, end] } },
              { text: '最近14天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 14); return [start, end] } },
              { text: '最近30天', value: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30); return [start, end] } },
              { text: '本月', value: () => { const end = new Date(); const start = new Date(end.getFullYear(), end.getMonth(), 1); return [start, end] } }
            ]"
          />
        </div>
      </template>
      <div ref="chartRef" class="chart-container"></div>
    </el-card>

    <!-- TOP Agent 排行 -->
    <el-card class="rank-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>TOP Agent 使用排行</span>
        </div>
      </template>
      <el-table :data="topAgents" stripe>
        <el-table-column label="排名" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.rank === 1" type="danger" effect="dark" round>{{ row.rank }}</el-tag>
            <el-tag v-else-if="row.rank === 2" type="warning" effect="dark" round>{{ row.rank }}</el-tag>
            <el-tag v-else-if="row.rank === 3" type="success" effect="dark" round>{{ row.rank }}</el-tag>
            <span v-else>{{ row.rank }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="agentName" label="Agent 名称" min-width="150" />
        <el-table-column label="Token 使用量" min-width="120" align="right">
          <template #default="{ row }">
            {{ formatNumber(row.totalTokens) }}
          </template>
        </el-table-column>
        <el-table-column label="调用次数" min-width="100" align="right">
          <template #default="{ row }">
            {{ formatNumber(row.apiCalls) }}
          </template>
        </el-table-column>
        <el-table-column label="平均 RPM" min-width="100" align="right">
          <template #default="{ row }">
            {{ formatRpm(row.averageRpm || 0) }}
          </template>
        </el-table-column>
        <el-table-column label="峰值 RPM" min-width="100" align="right">
          <template #default="{ row }">
            {{ row.peakRpm || 0 }}
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="topAgents.length === 0" description="暂无数据" />
    </el-card>
  </div>
</template>

<style scoped>
.overview-row {
  margin-bottom: 20px;
}

.overview-card {
  display: flex;
  align-items: center;
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 12px;
  overflow: hidden;
}

.overview-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 20px;
}

.overview-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-right: 16px;
  flex-shrink: 0;
}

.overview-content {
  flex: 1;
}

.overview-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.overview-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-card {
  margin-bottom: 20px;
  border-radius: 12px;
  overflow: hidden;
}

.chart-card :deep(.el-card__header) {
  border-radius: 12px 12px 0 0;
}

.chart-container {
  height: 350px;
  width: 100%;
}

.rank-card {
  margin-bottom: 20px;
  border-radius: 12px;
  overflow: hidden;
}

.rank-card :deep(.el-card__header) {
  border-radius: 12px 12px 0 0;
}
</style>
