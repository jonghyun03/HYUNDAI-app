param(
    [string]$TextPath = $env:WOORICHA_TTS_TEXT,
    [string]$OutputPath = $env:WOORICHA_TTS_OUTPUT,
    [string]$Voice = $env:WOORICHA_TTS_VOICE,
    [switch]$List
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $voices = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled })
    if ($List -or $env:WOORICHA_TTS_LIST -eq '1') {
        $voices | ForEach-Object { '{0} ({1})' -f $_.VoiceInfo.Name, $_.VoiceInfo.Culture.Name }
        exit 0
    }
    if ($Voice) {
        $synth.SelectVoice($Voice)
    } else {
        $korean = @($voices | Where-Object { $_.VoiceInfo.Culture.Name -eq 'ko-KR' })
        if ($korean.Count -eq 0) {
            throw 'No Korean SAPI voice installed. Install a Korean desktop TTS voice or set TTS_VOICE to an installed voice. See WINDOWS.md.'
        }
        $synth.SelectVoice($korean[0].VoiceInfo.Name)
    }
    $text = [System.IO.File]::ReadAllText($TextPath, [System.Text.Encoding]::UTF8)
    $synth.SetOutputToWaveFile($OutputPath)
    $synth.Speak($text)
} finally {
    $synth.Dispose()
}
