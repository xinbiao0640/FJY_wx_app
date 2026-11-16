function time(value) {
  const timestamp=Date.parse(value)
  if(!Number.isFinite(timestamp))return '—'
  const date=new Date(timestamp+8*60*60*1000),pad=n=>('0'+n).slice(-2)
  return date.getUTCFullYear()+'-'+pad(date.getUTCMonth()+1)+'-'+pad(date.getUTCDate())+' '+pad(date.getUTCHours())+':'+pad(date.getUTCMinutes())+':'+pad(date.getUTCSeconds())
}
function view(subject) {
  return subject?Object.assign({},subject,{appliedAtText:time(subject.appliedAt),reviewedAtText:time(subject.reviewedAt),reviewerText:subject.reviewerName||subject.reviewerId||'—'}):null
}
module.exports={time,view}
