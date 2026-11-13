Component({properties:{type:{type:String,value:'幸运转盘'}},data:{prizes:['2注好礼','谢谢参与','幸运权益','好运相伴','2注好礼','下次再来','幸运权益','一份惊喜']},methods:{play(){this.triggerEvent('play')}}})
