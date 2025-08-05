
    const test = {
      setCustomLanguage: function() {
      // NOTE : 25.07 자동완성 리팩토링
      // TODO: 아래 주석 부분들은 필요한 경우
      // monaco.languages.register({ id: this.lang });

      // Worker 응답을 Promise로 감싸는 헬퍼 함수
      this.getWorkerSuggestions = message => {
        return new Promise(resolve => {
          const handleMessage = event => {
            resolve(event.data) 
            // 1. 왜 등록 된 워커를 removeEventListener를 할까요?
            /**
             * A. 
             *    EventListenr는 전역으로 등록되는건데 
             *    안지워주면 계속남아있음. (메모리 낭비 및 데이터 중복이슈 발생할 수도 있음)
             *    즉, 코드 제안하는 부분이 중복해서 계속 늘어나지 않을까라는생각?
             *    ex) 
             *      -> 제안1, 제안2, 제안3, 제안4
             *      -> 제안1, 제안2, 제안3, 제안4, 제안1, 제안2, 제안3
             *      -> 제안1, 제안2, 제안3, 제안4, 제안1, 제안2, 제안3, 제안1, 제안2 ...
             *      이런식으로 쌓일 것 같음.. 
             *      또한, '개발자도구' -> '요소' -> '이벤트 리스너' 부분에 이벤트가 사라지지않고 평생 존재할듯
             */
            this.worker.removeEventListener('message', handleMessage)
          }

          this.worker.addEventListener('message', handleMessage)
          this.worker.postMessage(message)
        })
      }

      // (...중략...)
    }
  }
    // 아래 registerCompletionItemProvider 함수, triggerCharacters, provideCompletionItems는 모나코 문법
    // 2. 모나코에서 왜 provideCompletionItems를 async로 리턴 해줄까요?
    /**
     * A.
     *    provide, complete, items 의 단어를 보고 유추해보면,,
     *    뭔가 파싱이 완료된 items를 전달해 주는것 같은데,
     *    파싱이 완료되기전에 값을 전달하면 Promise 객체가 던져지지 않을까요 ?
     *    그래서 원해는 데이터가 안나올것 같은데요 .. 
     *    pending, fulfilled, rejected 중에서 하나 나올거같은데요
     */
      monaco.languages.registerCompletionItemProvider(this.lang, {
        triggerCharacters: ['.'],

        provideCompletionItems: async () => {
               if (webSquareLangList) {
                // 아래부터 이번에 추가된 코드 입니다.
                /*
                this.jsObjectList의 type은 [{},{},{},{}...]
                  eventMethod로 얻을 수 있는 값은 
                 {
                    "displayName": "scwin.input1_onchange(info)",
                    "loc": {
                        "start": {
                            "line": 8,
                            "column": 0
                        },
                        "end": {
                            "line": 16,
                            "column": 2
                        }
                    }
                }
                */

                // 3. 왜 find 함수를 사용 했을까요?
                /**
                 * jsObjectList와 커서가 가있는 메소드를 isSameMethod를 사용해서 가져옴.
                 * 해당하는 메소드의 첫번째 요소를 eventMethod 변수할당 하여 사용하려고
                 */
                const eventMethod = this.jsObjectList.find(item =>
                  this.isSameMethod(item, this.cursorMethodName),
                )
                
                /**
                 * NOTE
                 *    () 에 있는 값을 추출하기 위한 정규식
                 *    ex) scwin.input1_onchange(info)
                 *      -> info 추출
                 */
                const argsMatch = eventMethod?.displayName?.match(/\(([^)]*)\)/)
                let args = []
                if (argsMatch && argsMatch[1]) {
                  args = argsMatch[1]
                    .split(',')
                    .map(arg => arg.trim())
                    .filter(arg => arg.length > 0)
                }

                const target = tag.replace('.', '')

                if (args.includes(target)) {
                  const trimmedDisplayName =
                    eventMethod?.displayName.match(/^\$?\w+\.(\w+)/)?.[1] || ''
                  const eventCompInfo = this.eventCompInfo[this.eventCompInfo.length - 1]

                  if (!eventCompInfo) return

                  if (
                    trimmedDisplayName?.includes(eventCompInfo[this.eventUID]?.id) &&
                    eventMethod?.displayName?.includes(target)
                  ) {
                    const splitMethodName = trimmedDisplayName.split('_')
                    const onlyMethodName = splitMethodName[splitMethodName.length - 1]

                    const type = eventCompInfo[this.eventUID]?.type
                    const wqEventJson = this.wqEventJson

                    const message = {
                      wqEventJson,
                      onlyMethodName,
                      target,
                      type,
                    }

                    try {
                      const workerResult = await this.getWorkerSuggestions(message)
                      // eventParamInfo 일 때 param 삭제
                      const eventParamInfo = true
                      suggestions = suggestions.concat(
                        this.getSuggestions(workerResult, eventParamInfo),
                      )
                    } catch (err) {
                      console.error('Worker 실패:', err)
                    }
                  }
                } else return
              }
            }
      })
    