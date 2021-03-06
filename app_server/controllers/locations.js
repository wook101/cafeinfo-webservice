const Location = require('mongoose').model('Location'); 
const { response } = require('express');
const { RequestHeaderFieldsTooLarge } = require('http-errors');
const request = require('request');
let lat,lng;
const sendJsonResponse = function(res, status, content){ //상태, json응답을 함수로 만듬
    res.status(status);
    res.json(content);
}
const apiOptions = {
    server : "http://localhost:3000"
};
if (process.env.NODE_ENV==='production'){
    apiOptions.server = "https://cafemean.herokuapp.com";    //외부 호스트 주소
}

const renderMainpage = function(req,res,responseBody){
    let errorMessage;
    if (!(responseBody instanceof Array)){
        errorMessage = "/api/locations 요청 error";       //쿼리스트링에서 파라미터가 빠져있을 경우 404에러가 발생한다.
        responseBody = [];
    }else{
        if (!responseBody.length){
            errorMessage = "주위에 카페가 존재하지 않습니다.";
        }    
    }
    
    res.render('mainPage',{
        title: '메인화면',
        pageHeader: {
            title:'Cafe',
            strapline: '주위에 카페를 찾아보세요!'
        },
        sidebar:'메인페이지의 사이드바입니다~~~, Cafe.......................................',
        locations: responseBody,
        errorMessage: errorMessage
    });
}

const _formatDistance = function(distance){
    let retDistance;
    if (distance >= 1){ //거리가 1km이상인 경우 소수점1자리까지 반올림 후 km를 붙임
        retDistance = parseFloat(distance).toFixed(1) + 'km';
    } else {
        retDistance = parseInt(distance*1000)+ 'm';   //그렇지 않으면 미터 단위로 변경
    }
    return retDistance;
}

const renderDetailPage = function(req,res,locationDetail){
    res.render('location-detail',{
        title: locationDetail.name,
        pageHeader: {title: locationDetail.name},
        sidebar: "상세페이지의 사이드바 입니다.~~ Cafe..........................",
        location: locationDetail
    })
}
const renderReviewForm = function(req,res,locationDetail){
    res.render('location-review',{
        title: locationDetail.name,
        pageHeader: {title:locationDetail.name+' 리뷰를 작성해주세요~'},
        error: req.query.err
    });
};
const _showError = function(req, res, status){
    let title, content;
    if (status==404){
        title = "404, 페이지를 찾을 수 없습니다.";
        content = "요청하신 페이지를 찾을 수 없습니다.";
    }else{
        title = status + ", 오류가 발생했습니다.";
        content = "약간의 잘못된 오류가 발생했습니다.";
    }
    res.status(status);
    res.render('error',{
       title: title,
       content: content 
    });
};

const getLocationInfo = function(req,res,callback){
    let requestOptions,path;
    path = "/api/locations/"+req.params.locationid;
    requestOptions = {
        url : apiOptions.server + path,
        method : "GET",
        json : {}
    };
    request(requestOptions, function(err, response, body){
        let data = body;
        if (response.statusCode==200){
            data.coordinates = {
                lng: body.coordinates[0],
                lat: body.coordinates[1]
            };
            callback(req,res,data);
        }else{
            _showError(req,res,response.statusCode);
        }
    });
}
//현재 위치 정보를 얻기위한 페이지
module.exports.geolocationGet = function(req,res){
    res.render("geolocation",{
        title: '메인화면',
        pageHeader: {
            title:'Cafe',
            strapline: '주위에 카페를 찾아보세요!'
        }
    });
};

//현재 위치 정보 서버에 저장
module.exports.geolocationPost = function(req,res){
    lat = req.body.lat;
    lng = req.body.lng;
    res.json(req.body);
};

//메인페이지의 위치 리스트 정보
module.exports.locationList = function(req,res){
    if (lat==undefined && lng==undefined){
        sendJsonResponse(res,404,{"message":"현재 위치 정보를 알 수 없습니다."});
        return;
    }
    let requestOptions, path;
    path = '/api/locations';
    requestOptions = {
        url : apiOptions.server + path,
        method : "GET",
        json : {},
        qs : {                  //해당 좌표 기준
            lng : lng,
            lat : lat,
            maxDistance : 100     //최대 카페 탐지 거리 (단위km) ex)반경 100km이내 카페가 존재하는지!
        }
    }; 
    request(requestOptions, function(err, response, body){
        if(err) sendJsonResponse(res,404,err);
        if(response.statusCode==200 && body.length){
            for(let i=0; i<body.length;i++){
                body[i].distance = _formatDistance(body[i].distance);
            }
        }
        renderMainpage(req, res, body);
    });


};


//위치 상세정보
module.exports.locationDetail = function(req, res){
    getLocationInfo(req,res,function(req,res,responseData){
        renderDetailPage(req,res,responseData);
    });
};

//리뷰 작성 페이지 get
module.exports.addReview = function(req,res){
    getLocationInfo(req,res,function(req,res,responseData){
        renderReviewForm(req,res,responseData);
    });    
};


//리뷰 추가 post
module.exports.doAddReview = function(req,res){
   let requestOptions,path,locationid,postdata;
   locationid = req.params.locationid;
   path = "/api/locations/"+locationid+'/reviews';
   postdata = {
       author: req.body.name,
       rating: parseInt(req.body.rating, 10),
       reviewText: req.body.review
   };
   requestOptions = {
       url: apiOptions.server + path,
       method: "POST",
       json: postdata
   };
   //데이터를 api에 보내기 전에 유효성 검사하기
   if(!postdata.author || !postdata.rating || !postdata.reviewText){
       res.redirect('/location/'+locationid+'/reviews/new?err=val');
   } else{
        request(requestOptions, function(err,response,body){
            if(response.statusCode===201){
                res.redirect('/location/'+locationid);
            }else if(response.statusCode===400 && body.name && body.name==="ValidationError"){
                res.redirect('/location/'+locationid+'/reviews/new?err=val');
            }
            else{
                _showError(req,res,response.statusCode);
            }
        });
    }

};
