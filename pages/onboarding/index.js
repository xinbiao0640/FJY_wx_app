const page=require('../../utils/page')('onboarding')
Object.assign(page.data,{"fields": [{"key": "name", "label": "商户 / 门店名称", "placeholder": "如：拾光咖啡 · 西湖店"}, {"key": "contact", "label": "联系人", "placeholder": "请输入负责人姓名"}, {"key": "phone", "label": "联系电话", "placeholder": "11位手机号"}, {"key": "invite", "label": "代理邀请码（选填）", "placeholder": "不填则按平台直客入驻"}]})
Page(page)
