/* eslint-disable */
const PayUiClient = (function() {
    let _host = '';
    const _UiClient = function(environment) {

        if (environment === 'qa')
            _host = 'https://pay-qa.tmon.co.kr';
        else if (environment === 'dev')
            _host = 'https://pay-dev.tmon.co.kr';
        else if (environment === 'real')
            _host = 'https://pay.tmon.co.kr';

        this._client = new Client();
    };

    _UiClient.prototype = {
        getPayData: function(pg, tmonTid, selectedId, cartSrl) {
            const url = "/api/v1/payment/orders/" + tmonTid + "?pg=toss" + "&selectedId=" + selectedId + "&cartSrl=" + cartSrl;
            return this._client.fetchData(_host + url)
                .then((res) => {
                    return res;
                })
                .catch((err) => {
                })
                ;
        },
        makeAuthResult: function(url, data = {}) {
            return this._client.postData(url, data)
                .then((res) => {
                    return res;
                })
                .catch((error) => {
                })
                ;
        }
    }

    return _UiClient;
}());

const Client = (function() {
    const _client = function() {}

    _client.prototype = {
        fetchData: async function (url) {
            return await fetch( url, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'omit',
                referrerPolicy: 'no-referrer'
            })
                .then((response) => {
                    return response.json();
                })
                .then((res) => {
                    return res.data;
                })
                .catch((err) => {
                });
        },

        postData: async function (url = '', data = {}) {
            return await fetch(url + "&paymentId=" + data.paymentId, {
                method: 'GET',
                cache: 'no-cache',
                mode: 'cors',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            })
                .then((response) => response.json())
                .then((res) => {
                    return res.data;
                })
                .catch((err) => {
                });
        },

        get: async function (url, callFunc) {
            return await new Promise((resolve, reject) => $.get(url, callFunc));
        }
    }
    return _client;
}());

let Payment = (function(global) {
    'use strict';

    let _client = null;
    let _customisedOrderUiReturnUrl = null;
    let _orderUiHost = null;
    let _orderUiResultUrl = '/checkout/payment/result';

    let Pay = function({name, env, orderUiReturnUrl}) {
        this._pg = name;
        this._pay = null;
        _client = new PayUiClient(env);
        _customisedOrderUiReturnUrl = orderUiReturnUrl;
        _setOrderUiHost(env);

    };

    const _setOrderUiHost = function(env) {
        if (env === 'qa')
            _orderUiHost = 'https://order-qa.tmon.co.kr';
        else if (env === 'dev')
            _orderUiHost = 'https://order-dev.tmon.co.kr';
        else if (env === 'real')
            _orderUiHost = 'https://order.tmon.co.kr';
    }

    const _openGreenPayment = function(it, res) {
        if (it._pay === null) {
            it._pay = Naver.Pay.create(res.sdkParameters);
        }

        it._pay.open(res.reserveParameters);
    };

    const getEventTarget = function(targetUrl) {
        let domain = new URL(targetUrl);
        return domain.protocol + '//' + domain.host;
    }

    const getSuccessData = function(res) {
        return {
            'resultCode': res.code
            , 'message': res.errorMessage
            , 'data' : res.payments
            , 'tmonTid': res.tmonTid
            , 'type': 'TMON:PAY_RESULT'
            , 'orderUiReturnUrl': res.orderUiReturnUrl
        };
    }

    const getFailureData = function(message, orderUiReturnUrl) {
        return {
            'code': 'FAIL'
            , 'type': 'TMON:PAY_RESULT'
            , 'tmonTid': ''
            , 'payments': ''
            , 'errorMessage': message
            , 'orderUiReturnUrl': orderUiReturnUrl
        };
    }

    const _onAuthorize = function(oData) {
        const returnUrl = oData.returnUrl;

        if(oData.resultCode === "Success") {
            _client.makeAuthResult(returnUrl, oData)
                .then((res) => {
                    const returnUrl = (_customisedOrderUiReturnUrl !== null) ? _customisedOrderUiReturnUrl : res.orderUiReturnUrl;
                    window.postMessage(getSuccessData(res), getEventTarget(returnUrl));
                })
                .catch((err) => {
                    alert(err);
                });
        } else {
            (async () => {
                _client.makeAuthResult(returnUrl, oData);
            })();

            let resultUrl = _orderUiHost + _orderUiResultUrl;
            if (_customisedOrderUiReturnUrl !== null)
                resultUrl = _customisedOrderUiReturnUrl;

            try {
                let errorMessage = oData.resultMessage;

                if ("UserCancel" === oData.resultCode && !oData.resultMessage)
                    errorMessage = "결제를 취소하셨습니다. 주문 내용 확인 후 다시 결제해주세요.";
                else if ("OwnerAuthFail" === oData.resultCode && !oData.resultMessage)
                    errorMessage = "타인 명의 카드는 결제가 불가능합니다. 회원 본인 명의의 카드로 결제해주세요.";
                else if ("PaymentTimeExpire" === oData.resultCode && !oData.resultMessage)
                    errorMessage = "결제 가능한 시간이 지났습니다. 주문 내용 확인 후 다시 결제해주세요.";
                else if (!oData.resultMessage)
                    errorMessage = "결제를 실패했습니다. 잠시 후에 다시 시도해주시기 바랍니다";

                window.postMessage(getFailureData(errorMessage, resultUrl), getEventTarget(resultUrl));
            } catch (error) {
            }
        }
    }

    Pay.prototype = {
        open: function(tmonTid, selectedId, cartSrl) {
            _client
                .getPayData(this._pg, tmonTid, selectedId, cartSrl)
                .then((res) => {
                    const platform = res.platform;
                    if (platform !== 'WEB')
                        _orderUiHost += '/m';

                    let sdk = res.sdkParameters;
                    sdk.onAuthorize = _onAuthorize;

                    _openGreenPayment(this, {
                        'sdkParameters': sdk
                        , 'reserveParameters': res.reserveParameters
                    });
                })
                .catch((err) => {
                });
        }
    };

    return Pay;
}(this));
