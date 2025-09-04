var express = require('express');
var router = express.Router();
var fetch = require('node-fetch');


// 테스트용 인증서정보(직렬화)
const KCP_CERT_INFO = '-----BEGIN CERTIFICATE-----MIIDgTCCAmmgAwIBAgIHBy4lYNG7ojANBgkqhkiG9w0BAQsFADBzMQswCQYDVQQGEwJLUjEOMAwGA1UECAwFU2VvdWwxEDAOBgNVBAcMB0d1cm8tZ3UxFTATBgNVBAoMDE5ITktDUCBDb3JwLjETMBEGA1UECwwKSVQgQ2VudGVyLjEWMBQGA1UEAwwNc3BsLmtjcC5jby5rcjAeFw0yMTA2MjkwMDM0MzdaFw0yNjA2MjgwMDM0MzdaMHAxCzAJBgNVBAYTAktSMQ4wDAYDVQQIDAVTZW91bDEQMA4GA1UEBwwHR3Vyby1ndTERMA8GA1UECgwITG9jYWxXZWIxETAPBgNVBAsMCERFVlBHV0VCMRkwFwYDVQQDDBAyMDIxMDYyOTEwMDAwMDI0MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAppkVQkU4SwNTYbIUaNDVhu2w1uvG4qip0U7h9n90cLfKymIRKDiebLhLIVFctuhTmgY7tkE7yQTNkD+jXHYufQ/qj06ukwf1BtqUVru9mqa7ysU298B6l9v0Fv8h3ztTYvfHEBmpB6AoZDBChMEua7Or/L3C2vYtU/6lWLjBT1xwXVLvNN/7XpQokuWq0rnjSRThcXrDpWMbqYYUt/CL7YHosfBazAXLoN5JvTd1O9C3FPxLxwcIAI9H8SbWIQKhap7JeA/IUP1Vk4K/o3Yiytl6Aqh3U1egHfEdWNqwpaiHPuM/jsDkVzuS9FV4RCdcBEsRPnAWHz10w8CX7e7zdwIDAQABox0wGzAOBgNVHQ8BAf8EBAMCB4AwCQYDVR0TBAIwADANBgkqhkiG9w0BAQsFAAOCAQEAg9lYy+dM/8Dnz4COc+XIjEwr4FeC9ExnWaaxH6GlWjJbB94O2L26arrjT2hGl9jUzwd+BdvTGdNCpEjOz3KEq8yJhcu5mFxMskLnHNo1lg5qtydIID6eSgew3vm6d7b3O6pYd+NHdHQsuMw5S5z1m+0TbBQkb6A9RKE1md5/Yw+NymDy+c4NaKsbxepw+HtSOnma/R7TErQ/8qVioIthEpwbqyjgIoGzgOdEFsF9mfkt/5k6rR0WX8xzcro5XSB3T+oecMS54j0+nHyoS96/llRLqFDBUfWn5Cay7pJNWXCnw4jIiBsTBa3q95RVRyMEcDgPwugMXPXGBwNoMOOpuQ==-----END CERTIFICATE-----';

// INDEX PAGE
router.get('/', function(req, res) {
  res.render('index', {
    title : '가맹점 결제 샘플 페이지'
  });
});

// ORDER PAGE(PC)
router.get('/sample/order', function(req, res) {
  res.render('sample/order');
});

// MOBILE 거래등록 PAGE
router.get('/mobile_sample/trade_reg', function(req, res) {
  res.render('mobile_sample/trade_reg');
});

// MOBILE 거래등록 API
router.post('/mobile_sample/kcp_api_trade_reg', function(req, res) {
  // 거래등록처리 POST DATA
  var actionResult = f_get_parm(req.body.ActionResult); // pay_method에 매칭되는 값 (인증창 호출 시 필요)
  var van_code = f_get_parm(req.body.van_code); // (포인트,상품권 인증창 호출 시 필요)

  var post_data = {
    actionResult : actionResult,
    van_code : van_code
  };

  // 거래등록 API REQ DATA
  var req_data = {
    site_cd : f_get_parm(req.body.site_cd),
    kcp_cert_info : KCP_CERT_INFO,
    ordr_idxx : f_get_parm(req.body.ordr_idxx),
    good_mny : f_get_parm(req.body.good_mny),
    good_name : f_get_parm(req.body.good_name),
    pay_method : f_get_parm(req.body.pay_method),
    Ret_URL : f_get_parm(req.body.Ret_URL),
    escw_used : 'N',
    user_agent : ''
  };

  // 거래등록 API URL
  // 개발 : https://stg-spl.kcp.co.kr/std/tradeReg/register
  // 운영 : https://spl.kcp.co.kr/std/tradeReg/register
  fetch("https://stg-spl.kcp.co.kr/std/tradeReg/register", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req_data),
    })
    // 거래등록 API RES
    .then(response => {
      return response.json();
    })
    .then(data => {
      res.render('mobile_sample/kcp_api_trade_reg', {
        req_data : req_data,
        res_data : data,
        post_data : post_data
    });
  });
});

// 주문페이지 이동 및 Ret_URL 처리(MOBILE)
router.post('/mobile_sample/order_mobile', function(req, res) {
  var res_cd = f_get_parm(req.body.res_cd); 
  if( res_cd == '0000') {
    var enc_info = f_get_parm(req.body.enc_info);
    // enc_info 값이 없을 경우 POST DATA 처리 후 order_mobile 이동
    if( enc_info == '') {
      post_data = {
        approvalKey : f_get_parm(req.body.approvalKey),
        traceNo : f_get_parm(req.body.traceNo),
        PayUrl : f_get_parm(req.body.PayUrl),
        pay_method : f_get_parm(req.body.pay_method),
        actionResult : f_get_parm(req.body.ActionResult),
        Ret_URL : f_get_parm(req.body.Ret_URL),
        van_code : f_get_parm(req.body.van_code),
        site_cd : f_get_parm(req.body.site_cd),
        ordr_idxx : f_get_parm(req.body.ordr_idxx),
        good_name : f_get_parm(req.body.good_name),
        good_mny : f_get_parm(req.body.good_mny)
      };
    // enc_info 값이 있을 경우 결제 진행(결제인증 후 Ret_URL처리)
    } else {      
      post_data = {
        req_tx : f_get_parm(req.body.req_tx), // 요청 종류         
        res_cd : f_get_parm(req.body.res_cd), // 응답 코드
        site_cd : f_get_parm(req.body.site_cd), // 사이트코드       
        tran_cd : f_get_parm(req.body.tran_cd), // 트랜잭션 코드     
        ordr_idxx : f_get_parm(req.body.ordr_idxx), // 쇼핑몰 주문번호   
        good_name : f_get_parm(req.body.good_name), // 상품명            
        good_mny : f_get_parm(req.body.good_mny), // 결제금액       
        buyr_name : f_get_parm(req.body.buyr_name), // 주문자명            
        buyr_tel2 : f_get_parm(req.body.buyr_tel2), // 주문자 핸드폰 번호
        buyr_mail : f_get_parm(req.body.buyr_mail), // 주문자 E-mail 주소        
        enc_info : enc_info, // 암호화 정보       
        enc_data : f_get_parm(req.body.enc_data), // 암호화 데이터     
        param_opt_1 : '', // 기타 파라메터 추가 부분
        param_opt_2 : '', // 기타 파라메터 추가 부분
        param_opt_3 : ''  // 기타 파라메터 추가 부분
      };
    }

  } else {
    post_data = {
      res_cd : res_cd, // 응답 코드         
      res_msg : f_get_parm(req.body.res_msg) // 응답 메세지
    };
  }
  res.render('mobile_sample/order_mobile', {
    post_data : post_data
  });

});

// 결제요청 API
router.post('/kcp_api_pay', function(req, res) {
  var site_cd = f_get_parm(req.body.site_cd);
  
  // 결제 REQ DATA
  var req_data = {
    tran_cd : f_get_parm(req.body.tran_cd),
    site_cd : site_cd,
    kcp_cert_info : KCP_CERT_INFO,
    enc_data : f_get_parm(req.body.enc_data),
    enc_info : f_get_parm(req.body.enc_info),
    ordr_mony : '1004', // 실제 결제될 금액이 1004원이라면   ** 결제금액 유효성 검증 **
    pay_type : 'PACA' // 실제 결제할 수단이 신용카드라면 PACA세팅 ** 결제수단 유효성 검증 **
	
	// ordr_no : 'TEST123456789', // 실제 처리할 주문번호가 TEST123456789라면 ** 주문번호검증 **
	/*  ordr_no의 경우 결제창으로 전달하는 주문번호와
       실제 승인요청때 처리하는 주문번호가 동일해야하는 경우 검증처리바랍니다.
       다를경우 주문번호 검증은 하지 않으시기 바랍니다.                       */
  };
    
                                
  // 결제 API URL
  // 개발 : https://stg-spl.kcp.co.kr/gw/enc/v1/payment
  // 운영 : https://spl.kcp.co.kr/gw/enc/v1/payment
  fetch("https://stg-spl.kcp.co.kr/gw/enc/v1/payment", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req_data),
    })
    // 결제 API RES
    .then(response => {
      return response.json();
    })
    .then(data => {
           res.render('kcp_api_pay', {
          req_data : JSON.stringify(req_data),
          res_data : JSON.stringify(data),
          data : data
        });
      });   
    
});

// null 값 처리
function f_get_parm(val) {
  if ( val == null ) val = '';
  return val;
}

module.exports = router;
