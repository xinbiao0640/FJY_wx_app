const page=require('../../utils/page')('activity-edit')
Object.assign(page.data,{"fields": [{"key": "quotaBets", "label": "总名额 / 注", "tip": "名额以注计，不等于中奖人数"}, {"key": "winProbabilityPpm", "label": "中奖概率 / 百万分比", "tip": "0～1000000，例如250000表示25%"}, {"key": "maxWinnerCount", "label": "中奖人数上限", "tip": "概率抽样不保证发满"}, {"key": "perUserLimit", "label": "每人参与上限", "tip": "工程范围1～100次，未中奖也消耗次数"}]})
Page(page)
