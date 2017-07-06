const express = require('express')
const request = require('request')
const cheerio = require('cheerio')
const async = require('async')
const fs = require('fs')
const iconv = require('iconv-lite')
const app = express()
const bodyParser = require('body-parser')
const ejs = require('ejs')

Date.prototype.Format = function (fmt) { //author: meizz 
    var o = {
        "M+": this.getMonth() + 1, //月份 
        "d+": this.getDate(), //日 
        "h+": this.getHours(), //小时 
        "m+": this.getMinutes(), //分 
        "s+": this.getSeconds(), //秒 
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
        "S": this.getMilliseconds() //毫秒 
    }
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length))
    for (var k in o)
    if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

function getImgName(src){
    let reg = /(\w)+.(jpg|gif|png)/g
    let result = src.match(reg)
    if(result){
        return result[0]
    }
    return parseInt(Math.random()*1000 + '.jpg')
}

//设置bodyParser
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

//设置使用模板
app.engine('html', ejs.renderFile);
app.set("view engine", 'html')
app.set('views', __dirname + '/views')

let url = 'http://www.jsqq.net/qqtx/'
let page = 10
let time = new Date(new Date().getTime() - 86400000).Format("yyyyMMdd") //昨天
let path = 'jsqq'

app.get('/', function (req, res) {
  res.render('jsqq.html')
})

app.post('/', function (req, res) {
    let date = req.body.date || time //POST传来的时间
    request(url, (error, response, body)=>{
        if(error || response.statusCode != 200){
            console.log('爬取' + url + '页面出错!')
            return false
        }
        
        let $ = cheerio.load(body)
        // list_74_336.html
        let reg = /(list_74_|.html)/g
        let str = $('.bg_yema').children("a:last-child").attr('href')
        let anount = str.replace(reg,"")

        // console.log(anount)
        if(anount<1){
            anount = 1
        }
        if(anount<page){
            page = anount
        }
        // http://www.jsqq.net/qqtx/list_74_1.html
        let pageUrl = []
        for (let i = 0; i<page; i++){
            pageUrl.push('http://www.jsqq.net/qqtx/list_74_' + (i+1) + '.html')
        }

        let listUrl = []
        let listDate = []
        // console.log(pageUrl)
        async.mapLimit(pageUrl, 1, function(page, callback){
            request(page, function(error, response, body){
                if(error){
                    console.log('爬取页面出错!')
                    return false
                }
                let $ = cheerio.load(body)
                let list = $('.photo_cont a')
                let dateList = $('.photo_cont .photo_date')
                let reg = /-/g

                for(let i=0; i<list.length; i++){
                    let updateStr = dateList[i].children[0].data
                    let update = updateStr.replace(reg,"")
                    // console.log(update)
                    if(update < date){
                        // return false
                        break
                    }
                    listUrl.push(list[i].attribs.href)
                    listDate.push(update)
                }
                callback()
            })
        },function(){
            // console.log(listUrl)
            async.mapLimit(listUrl, 1, function(page, callback){
                request.get({
                    url: page,
                    encoding: null
                }, function(error, response, body){
                    if(error){
                        console.log('爬取页面出错!')
                        return false
                    }
                    let buf =  iconv.decode(body, 'gb2312');
                    let $ = cheerio.load(buf)
                    let img = $('.art_cont1 img')
                    let title = $('.art_tit h1').text()
                    let reg = /(\d{4})-(\d{2})-(\d{2})/g
                    let dateStr = $('.art_tit p').text()
                    // console.log(dateStr)
                    let date = dateStr.match(reg)[0].replace(reg,"$1$2$3")

                    // console.log(date)
                    let imgArr = []

                    img.each(function(){
                        imgArr.push($(this).attr('src'))
                    })

                    //console.log(imgArr)
                    let baseUrl = path + '/' + date + '-' + title //存放图片目录

                    if (!fs.existsSync(baseUrl)) {
                        // 创建目录
                        if(!fs.existsSync(path)){
                            fs.mkdirSync(path)
                        }
                        fs.mkdirSync(baseUrl)
                    }
                    async.mapLimit(imgArr, 1, function(src, callback){
                        let name = getImgName(src)
                        request(src).pipe(fs.createWriteStream(baseUrl+'/'+name)).on('close', ()=>{
                            console.log(name + '下载成功')
                            callback()
                        }) 
                    })
                    callback()
                })
            }, function(){
                console.log('完成')
                res.render('success.html')
            })
        })
    })
})
app.listen('3000', ()=>{
    console.log('请在浏览器访问：http://localhost:3000')
})
