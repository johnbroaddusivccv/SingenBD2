const TWO_PI = 2 * Math.PI

function play(audioContext, wave) {
  if (quickSave) {
    save(wave)
  }

  var channel = wave.channels
  var frame = wave.frames
  var buffer = audioContext.createBuffer(channel, frame, audioContext.sampleRate)

  for (var i = 0; i < wave.channels; ++i) {
    var waveFloat32 = new Float32Array(wave.data[i])
    buffer.copyToChannel(waveFloat32, i, 0)
  }

  if (this.source !== undefined) {
    this.source.stop()
  }
  this.source = audioContext.createBufferSource()
  this.source.buffer = buffer
  this.source.connect(audioContext.destination)
  this.source.start()
}

function save(wave) {
  var buffer = Wave.toBuffer(wave, wave.channels)
  var header = Wave.fileHeader(audioContext.sampleRate, wave.channels,
    buffer.length)

  var blob = new Blob([header, buffer], { type: "application/octet-stream" })
  var url = window.URL.createObjectURL(blob)

  var a = document.createElement("a")
  document.body.appendChild(a)
  a.style = "display: none"
  a.href = url
  a.download = "SingenBD2_" + Date.now() + ".wav"
  a.click()
  document.body.removeChild(a)

  window.URL.revokeObjectURL(url)
}

// lengthは秒数。
function makeWave(length, sampleRate) {
  var waveLength = Math.floor(sampleRate * length)
  var wave = new Array(waveLength).fill(0)
  for (var t = 0; t < wave.length; ++t) {
    var headmod = oscHeadMod.oscillate(t, 0, isFM)
    var head = oscHead.oscillate(t, headmod, isFM)
    wave[t] += 0.8 * oscBody.oscillate(t, head, isFM)
  }
  return wave
}

class Oscillator {
  // グローバルでTWO_PI = 2 * Math.PIが定義されていること。
  constructor(audioContext) {
    this.sampleRate = audioContext.sampleRate

    this.gainEnvelope = new Envelope(0.5)
    this.pitchEnvelope = new Envelope(0.5)
    this._pitchStart = 200
    this._pitchEnd = 30
    this._length = 960
    this.feedback = 0
    this.fmIndex = 0

    this.phase = 0
    this.pitch
    this.phaseReset = true

    this.twoPiRate = TWO_PI / this.sampleRate
    this.pitchDiff = this._pitchStart - this._pitchEnd
    this.pitchEndFixed = this._pitchEnd - 1
  }

  get length() {
    return this._length
  }

  set length(value) {
    this._length = (value < 0) ? 0 : Math.floor(this.sampleRate * value)
  }

  set pitchStart(value) {
    this._pitchStart = value
    this.pitchDiff = this._pitchStart - this._pitchEnd
  }

  set pitchEnd(value) {
    this._pitchEnd = value
    this.pitchDiff = this._pitchStart - this._pitchEnd
    this.pitchEndFixed = this._pitchEnd - 1
  }

  reset() {
    this.phase = (this.phaseReset) ? 0 : Math.abs(this.phase) % TWO_PI
  }

  // time は経過サンプル数。
  oscillate(time, modulation, isFM) {
    if (time > this._length || time < 0) {
      return 0
    }

    var envTime = time / this._length
    var output = this.gainEnvelope.decay(envTime) * Math.sin(this.phase)

    var pitchEnv = this.pitchEnvelope.decay(envTime)
    var mod = this.fmIndex * modulation + this.feedback * output
    if (isFM) {
      var pitch = this.pow(this.pitchDiff, pitchEnv + mod)
      this.phase += this.twoPiRate * (pitch + this.pitchEndFixed)
    }
    else {
      var pitch = this.pow(this.pitchDiff, pitchEnv)
      this.phase += this.twoPiRate * (pitch + this.pitchEndFixed) + mod
    }

    return output
  }

  // 虚数になる場合でも値を返す。
  pow(base, exponent) {
    if (base === 0) {
      return (exponent === 1) ? 1 : 0
    }
    return Math.sign(base) * Math.pow(Math.abs(base), exponent)
  }
}

class OscillatorControls {
  constructor(parent, label, oscillator,
    minLength, maxLength, stepLength,
    maxGainTension, maxPitchTension, maxPitchStart, maxPitchEnd,
    refreshFunc
  ) {
    this.oscillator = oscillator

    this.div = new Div(parent, label)
    this.div.element.className = "oscillatorControls"
    var divElement = this.div.element

    this.heading = new Heading(divElement, 6, label)
    this.length = new NumberInput(divElement, "Length",
      maxLength / 2, minLength, maxLength, stepLength, refreshFunc)
    this.feedback = new NumberInput(divElement, "Feedback",
      0, 0, 0.1, 0.001, refreshFunc)
    this.gainTension = new NumberInput(divElement, "GainTension",
      maxGainTension / 2, 0, maxGainTension, 0.01, refreshFunc)
    this.pitchStart = new NumberInput(divElement, "PitchStart",
      200, 5, maxPitchStart, 1, (value) => {
        this.pitchStart.value = Math.max(value, this.pitchEnd.value)
        refreshFunc()
      })
    this.pitchEnd = new NumberInput(divElement, "PitchEnd",
      30, 5, maxPitchEnd, 1, (value) => {
        this.pitchEnd.value = Math.min(value, this.pitchStart.value)
        refreshFunc()
      })
    this.pitchTension = new NumberInput(divElement, "PitchTension",
      maxPitchTension / 2, 0, maxPitchTension, 0.01, refreshFunc)
  }

  random(feedback) {
    this.length.random()
    this.gainTension.random()
    this.pitchTension.random()
    if (feedback) {
      this.feedback.random()
    }

    this.pitchStart.random()
    this.pitchEnd.random()
    if (this.pitchStart.value < this.pitchEnd.value) {
      this.pitchStart.value = this.pitchEnd.value
    }
  }

  refresh() {
    this.oscillator.length = this.length.value
    this.oscillator.feedback = this.feedback.value
    this.oscillator.gainEnvelope.tension = this.gainTension.value
    this.oscillator.pitchStart = this.pitchStart.value
    this.oscillator.pitchEnd = this.pitchEnd.value
    this.oscillator.pitchEnvelope.tension = this.pitchTension.value
    this.oscillator.reset()
  }
}

function random(randomBody) {
  if (randomBody) {
    oscBodyControls.random(isFM)
  }
  oscHeadControls.random(true)
  inputBodyFM.random()
  inputHeadFM.random()
  inputHeadRatio.random()

  refresh()
  play(audioContext, wave)
}

function refresh() {
  oscBodyControls.refresh()
  oscHeadControls.refresh()

  oscHeadMod.length = oscHeadControls.length.value
  oscHeadMod.feedback = oscHeadControls.feedback.value
  oscHeadMod.gainEnvelope.tension = oscHeadControls.gainTension.value
  oscHeadMod.pitchStart = oscHeadControls.pitchStart.value * inputHeadRatio.value
  oscHeadMod.pitchEnd = oscHeadControls.pitchEnd.value * inputHeadRatio.value
  oscHeadMod.pitchEnvelope.tension = oscHeadControls.pitchTension.value
  oscHeadMod.reset()

  oscBody.fmIndex = inputBodyFM.value
  oscHead.fmIndex = inputHeadFM.value

  wave.left = makeWave(oscBodyControls.length.value, audioContext.sampleRate)
  wave.declick(inputDeclick.value)

  waveView.set(wave.left)
  waveViewGainEnvelope.set(oscBody.gainEnvelope.makeTable(envelopeViewWidth))
  waveViewPitchEnvelope.set(oscBody.pitchEnvelope.makeTable(envelopeViewWidth))
}

var audioContext = new AudioContext()

var isFM = true
var quickSave = false
var oscBody = new Oscillator(audioContext)
var oscHead = new Oscillator(audioContext)
var oscHeadMod = new Oscillator(audioContext)
var wave = new Wave(1)
wave.left = makeWave(0.02, audioContext.sampleRate, 200, 30)


var divMain = new Div(document.body, "main")
var headingTitle = new Heading(divMain.element, 1, "SingenBD2")

var description = new Description(divMain.element)
description.add("さくっと使う", "SingenBD2はバスドラムを作るシンセサイザーです。まずはRandomボタンを何回か押して音を試してみてください。おおまかな音の雰囲気が気に入ったら、RandomHaedボタンでアタックの質感だけを変えることができます。狙って音を作る場合はPlayボタンで試聴できます。")
description.add("概説", "中身は3オペレータを直列につないだFMシンセです。出力 <- Body <- Head <- HeadModと接続されています。HeadModは直接操作できませんが、Headのパラメータにほぼ追従します。Body <- Headの変調インデックスがBodyFM、Head <- HeadModの変調インデックスがHeadFMです。")
description.add("Tips", "TypeをPMにしたときは、BodyのFeedbackを0にしてみてください。また、DeclickInでアタックの鋭さを調整できます。")

var divWaveform = new Div(divMain.element, "waveform")
var headingGainEnvelope = new Heading(divWaveform.element, 6, "Waveform")
var waveView = new WaveView(divWaveform.element, 512, 256, wave.left, false)

var envelopeViewWidth = 256
var envelopeViewHeight = 128
var divEnvelopeView = new Div(divMain.element, "envelopeView")
var divGainEnvelope = new Div(divEnvelopeView.element, "gainEnvelope")
var headingGainEnvelope = new Heading(divGainEnvelope.element, 6, "Body - Gain")
var waveViewGainEnvelope = new WaveView(divGainEnvelope.element, envelopeViewWidth,
  envelopeViewHeight, oscBody.gainEnvelope.makeTable(envelopeViewWidth), true)
var divPitchEnvelope = new Div(divEnvelopeView.element, "pitchEnvelope")
var headingPitchEnvelope = new Heading(divPitchEnvelope.element, 6, "Body - Pitch")
var waveViewPitchEnvelope = new WaveView(divPitchEnvelope.element, envelopeViewWidth,
  envelopeViewHeight, oscBody.pitchEnvelope.makeTable(envelopeViewWidth), true)

var divRenderControls = new Div(divMain.element, "renderControls")
var buttonPlay = new Button(divRenderControls.element, "Play",
  () => play(audioContext, wave))
var buttonRandom = new Button(divRenderControls.element, "Random",
  () => random(true))
var buttonRandomHead = new Button(divRenderControls.element, "RandomHead",
  () => random(false))
var buttonSave = new Button(divRenderControls.element, "Save",
  () => save(wave))
var checkboxQuickSave = new Checkbox(divRenderControls.element, "QuickSave",
  quickSave, (checked) => { quickSave = checked })

var oscBodyControls = new OscillatorControls(divMain.element, "Body",
  oscBody, 0.01, 1, 0.01, 1, 1, 1000, 100, refresh)
var oscHeadControls = new OscillatorControls(divMain.element, "Head",
  oscHead, 0.0001, 0.04, 0.0001, 0.5, 0.5, 4000, 2000, refresh)

var divFMControls = new Div(divMain.element, "fmControls")
var headingModulation = new Heading(divFMControls.element, 6, "Modulation")
var radioButtonModulationType = new RadioButton(divFMControls.element, "Type",
  (value) => { isFM = value === "FM"; refresh() })
radioButtonModulationType.add("FM")
radioButtonModulationType.add("PM")
var inputBodyFM = new NumberInput(divFMControls.element, "BodyFM",
  0.62, 0, 2, 0.01, refresh)
var inputHeadFM = new NumberInput(divFMControls.element, "HeadFM",
  1, 0, 2, 0.01, refresh)
var inputHeadRatio = new NumberInput(divFMControls.element, "HeadRatio",
  1.6666, 0, 8, 0.0001, refresh)
var tenMilliSecond = audioContext.sampleRate / 100
var inputDeclick = new NumberInput(divFMControls.element, "DeclickIn",
  0, 0, tenMilliSecond, 1, refresh)

refresh()
