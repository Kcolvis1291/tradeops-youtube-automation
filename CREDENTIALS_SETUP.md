# TradeOps v3 — Credentials Setup Guide

This guide walks you through setting up all API credentials needed for full autonomous video production and multi-platform publishing.

---

## Railway Environment Variables

Set these in your Railway project under **Settings → Variables**.

### Required (Core)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key — get at console.anthropic.com |

### Optional — Video Production

| Variable | Description |
|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs TTS key — enables auto voiceover generation |

Without `ELEVENLABS_API_KEY`, the pipeline still generates scripts/SEO/thumbnails but skips video render and publishing.

### Optional — YouTube

| Variable | Description |
|---|---|
| `YOUTUBE_CLIENT_ID` | Google Cloud OAuth2 Client ID |
| `YOUTUBE_CLIENT_SECRET` | Google Cloud OAuth2 Client Secret |
| `YOUTUBE_REFRESH_TOKEN` | OAuth2 refresh token (obtained via /auth/youtube flow below) |
| `YOUTUBE_REDIRECT_URI` | Optional — defaults to `{SELF_URL}/auth/youtube/callback` |

### Optional — TikTok

| Variable | Description |
|---|---|
| `TIKTOK_ACCESS_TOKEN` | TikTok for Business access token |

### Optional — Instagram

| Variable | Description |
|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | Long-lived Instagram Graph API access token |
| `INSTAGRAM_USER_ID` | Instagram Business account user ID |

### Optional — Twitter/X

| Variable | Description |
|---|---|
| `TWITTER_API_KEY` | Twitter App API Key (Consumer Key) |
| `TWITTER_API_SECRET` | Twitter App API Secret (Consumer Secret) |
| `TWITTER_ACCESS_TOKEN` | OAuth 1.0a Access Token |
| `TWITTER_ACCESS_TOKEN_SECRET` | OAuth 1.0a Access Token Secret |
| `TWITTER_HANDLE` | Your Twitter handle without @ (e.g. `TradeOps`) |

### Optional — Notifications

| Variable | Description |
|---|---|
| `NOTIFY_WEBHOOK_URL` | Slack/Discord webhook URL for pipeline completion alerts |
| `SELF_URL` | Your Railway public URL (e.g. `https://tradeops.up.railway.app`) — enables keep-alive ping and Instagram video serving |

---

## Step-by-Step Setup

### 1. ElevenLabs (TTS Voiceover)

1. Go to [elevenlabs.io](https://elevenlabs.io) → sign up (free tier works)
2. Click your profile → **API Keys**
3. Create a new key → copy it
4. Set `ELEVENLABS_API_KEY` in Railway

The pipeline uses the **Adam** voice by default. To change voices, edit `agents/elevenLabsAgent.js` and update `VOICE_ID`.

---

### 2. YouTube (Auto-Upload via OAuth2)

#### Create Google Cloud Project & OAuth Credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **YouTube Data API v3**: APIs & Services → Enable APIs → search "YouTube Data API v3"
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add Authorized redirect URI: `https://your-railway-url.up.railway.app/auth/youtube/callback`
7. Copy
���Y[�Q
��[�
���Y[��Xܙ]
�����]S�UP�W��QS��Q[�S�UP�W��QS���PԑU[��Z[�^B�������]�Y��\���[�
ۙKU[YH�]\
B��K�\�HH�\��\��]S�UP�W��QS��Q[�S�UP�W��QS���PԑU�]����\�]΋��[�\�\�Z[�^K]\��\��Z[�^K�\�]]�[�]X�X[�[�\������\��ˈ]]ܚ^�H�][�\�[�UX�HX���[�����HH�Y��\����[���ۈۈ�ܙY[��K��]S�UP�WԑQ��T����S�[��Z[�^B����Y\�H8�%[�UX�H]]�]\�Y\����X�]�B��KKB�����ˈZ���
]]�T���XH�۝[���[��TJB��K�����]�[�\�˝Z��˘��WJ΋��]�[�\�˝Z��˘��JH8���ܙX]H[�\���Y��X��
���۝[���[��TJ���ˈ�\]Y\����\Έ�Y[˝\�Y�Y[˜X�\����]\�ݙY
X^HZ�HH�]�^\��܈\�X���X��\��B�K��[�\�]H[�X��\����[��܈[�\�Z���X���[�����]R����P��T�����S�[��Z[�^B���
����N���Z����\]Z\�\�H�\�[�\��܈ܙX]܈X���[��H��[�^\�\�8�%�]\��[��Y��\�\��YYY���KKB�����
�[��Yܘ[H�Y[�
�XH�X�X����ܘ\TJB�������\]Z\�[Y[�H[��Yܘ[H
���\�[�\�ʊ�܈
��ܙX]܊��X���[��H�X�X����Y�H�ۛ�X�Y�H[��Yܘ[HX���[��H�X�X����]�[�\�\�][��Yܘ[Wؘ\�X�
�[��Yܘ[W��۝[��X�\�\�Z\��[ۜ������\�K�����]�[�\�˙�X�X���˘��WJ΋��]�[�\�˙�X�X���˘��JH8���^H\�8���ܙX]H\���Y��X��
��[��Yܘ[Hܘ\TJ���ˈY\�Z\��[ۜΈ[��Yܘ[Wؘ\�X�[��Yܘ[W��۝[��X�\�Y�\�ܙXY�[��Y�[Y[����]\�]�Y]�Y[�\�ݙY�܈[��Yܘ[W��۝[��X�\��K��[�\�]HH
��ۙ�S]�YX��\����[���
�[Y
�^\�8�%�]\�Y��\�
N��H�ܝ[]�Y��[�8���^�[��H]�΋��ܘ\��X�X���˘��K��]]�X��\�����[��ܘ[��\OY���^�[��W���[���Y[��Y^�T�QI��Y[���Xܙ]^�T��PԑUI����^�[��W���[�^��ԕ���S�X����][�\�[��Yܘ[H\�\�Q��H΋��ܘ\��X�X���˘��K�YOٚY[�ZY�[YI�X��\�����[�^���S�X�ˈ�]S��QԐSW�P��T�����S�[�S��QԐSW�T�T��Q[��Z[�^B���]�S��T��[�\��Z[�^HX�X�T�
[��Yܘ[H�YY��[�Y[����HHX�X�T�
B��KKB�����
K��]\��
]]�T���]�Y[�B��K�����]�[�\���]\����WJ΋��]�[�\���]\����JH8����ڙX��	�\�8����]�\����]\\�Z\��[ۜ��
���XY[�ܚ]J���ˈ[�\�
���^\�[���[�ʊ���H��H
��TH�^J��[�
��TH�^H�Xܙ]
��8����]\��UT��TW��VX[��UT��TW��PԑU�H�[�\�]H
��X��\����[���[�
��X��\����[��Xܙ]
��8����]\��UT��P��T�����S�[��UT��P��T�����S���PԑU���]�UT��S�X�[�\��]\�\�\��[YH
�]�]
B���H\\�\�
���]]K�J���܈YYXH\�Y
�K�H[��[�
H[��Y]��[��
��[��[�
K�[]�]YX��\��X^H�H�\]Z\�Y�܈�Y[�\�Y˂��KKB�����\�Y�Z[���]\��ۘ�H\�YY]\�H[��[����\�Y�HXX�[�Yܘ][ێ�����U�X[8����\��\��]\�U�\K�\���\�8���\[[�Hݙ\��Y]���\K�\[[�Kܝ[�8���X[�X[H�Y��\�\[[�B��U�\K�X�\�\�]\�8���\�LX�\�Y������Y��\�H\��[����\���\�V��΋��[�\�\�Z[�^K]\��\��Z[�^K�\�\K�\[[�Kܝ[��R��۝[�U\N�\X�][ۋڜ�ۈ��Y	�Ȝ[\�����ؗ����[�ȋ��ܛX]���]ܚX[�I��KKB����]]�X]Y��Y[B��ۘ�H[ܙY[�X[�\�H�]H\[[�H�[��]]�X]X�[N���^H[YH
U
H�ܛX]�KK_KK_KK_�Y\�^H
N�SH]ܚX[�\��^H
N�SH��XZ��ۈ���Y^H
�K]�YZ�JH
N�SH[�\��Y]��Z[H
ΌSH�[���[�ۛH
