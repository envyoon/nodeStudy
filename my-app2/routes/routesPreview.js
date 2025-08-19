const express = require('express');
const { Worker } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const router = express.Router();

/* GET home page. */
router.get('/', function (req, res) {
  res.render('preview');
});

router.post('/getData', function (req, res, next) {
  
    try {
    
        //워커 경로 및 api.json 경로
        const workerPath = path.resolve(__dirname, '../public/worker/previewWorker.js');
        const getFile = path.resolve(__dirname, '../public/data/WebSquareAPI.json');

        fs.readFile(getFile, 'utf8', (err, data) => {
            if (err) return;

            //워커 선언
            const worker = new Worker(workerPath);

            worker.once('message', (result) => {
                //응답받은 값 리턴
                res.status(200).json(result);
            });

            // 에러발생 시 처리
            worker.once('error', (e) => {
                console.error('에러: ',e);
            });

            // 워커 종료
            worker.once('exit', (value) => {
                console.log('워커 종료')
            });

            // 실제 워커 처리 부분 (값 전달)
            worker.postMessage({
                apiJson: data,
                body: req.body,
            });

        });
    } catch (e) {
        console.error('에러: ',e);
    }

});

module.exports = router;