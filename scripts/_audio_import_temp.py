from __future__ import annotations

from pathlib import Path
import re
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "public" / "audio"
TMP = ROOT / ".audio-import-temp"
AUDIO.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)

URLS = {
    "footstep-run-a.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/RbYWzRMmif7G9UlMRCSb/1GjqOyJkJsiLG8o6bekj/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T165221Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=043605845f9d076df026770257b36a0c45f3a112cde7250ce551ea1fd9c95274a5b90f2831feb88e172eb6ed4299da5d5477e906fdf2d7b8f0e03c4d35a55c33e34bf1d624d7f5cbc14ef975eea0d5ea2c0776e80185b6db20c20f91c8545390baadf91aaccfc9ca19791b0f252caf4530724a93f6de87607bb42f95c730dfcd1d8be3e86962fb074b84f104c681fb01629221a14aca9a4186f693be9779a9522c15eef6ccc54734e4e971f031f02a2d3c532255f87dd63c2b81b250becd22ca441505f1d9a0ed9030f372da1ecae5da6c1cc3838aae067d8158adc48c7cf79939ddabab3b925276c39404453ee7fc122a35bac247ebd40b8adaebf2055630f8",
    "footstep-run-b.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/odAythLe4yQFLMw16JMy/Aad7Nrp69Wy7gmC7xyw2/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T165221Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=95c92030ae6aaf80f0b8b44792d3f39e17370c5fc04e65525da08a25fd42518952d868f80941ed58d8a7e2b2bbbc1de63166ff52e4fa4cc287b876de1f73f5e6a3a06c327d4fe9e7547dd7f48e523dbdafb86ec4c39c692d5aa51c4472446bc9ae7588edf70c36e4b2a82a4e7baba73a78c18c9e4449949351cf7e2fdfbe6a234c007a95724d8b93d4f160c0da30c4eb2159627a341ff58e017d2f238b9bd8d1cf2127b6c404ce9ae6cbdc7cd5feda7c7c9623c1bce0e66ef3b984368cc924f7f3ce9d0d20ceacec22faf431c953de1cd551ba4d600bfafad380701ca817c11b245a8feeaf4a33734e834689f991c1223eb3c392c8b4d523d7ab927fb4770903",
    "footstep-crouch-a.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/3LlvpLtenFTC5c4Zs1Yr/vy9JCmojS13dcmONEwiO/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T165049Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=343ce646e3db01c447f997e590999a645c2598c9cc69c89e37386d3e2ffe39536c4f1e589cb365be017ea0909f102ae0485775d46503ac277baeed578b3ff17ee3390abe385db9ec05a5b272d4b2e32f1333bd6f8e280d4e8289aa681f76aaeedcd526ca50f073408224d99c729c1bf82bdd80d212e3ba32e134d2098046aea53cd29f3cfd6275fd67a075beb8ecfb684725e570c3f059282c69a99d44cd74b72afa0e1dbb22ea81be4dbec4408b8d4ad9971e2269929164a4036b019bc0d51c80a92473bfe933e74b9629508e7c21e8e9ec3f2e3a27b6a4577ee3ea80f53e38cacf1aa8c56f1f9a3ca52b5cda7196b5088290125c2e99eefdc9a17121ba82f0",
    "footstep-crouch-b.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/p3bPil6WufV5spHfu4QW/ip9mAgWKegzYamztMnee/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T165049Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=1f9b7d575026a925a00491a4177f7c6e9b95e6998805164e75d0664bccc2f49df5abe058dd52541bc05fd2324a65138f2357081e6d91730beda45eaa83c243105f0224aa972553e24d386084ad0e1c6c0c93b0a098e3243e6f0f89e5e49a9422e2da9d604a8b2852a9b821ab6c8a28aeccbe8068e0514eff7ce2ad244b564c3b265fb43c63a39067633206d4a735908ba4c873bf2f7c37e670c48e661e5d3b79da0fb57f841ae58b828fd77d31495ead2b44b535bc4376775b6d566ac8f3c34c8fdc7587d7151baadf73b7a1cdfb0e71cc22fabc4a72a39cb3ed5c6f997c1c28649f0de4aec4b0e2958bae48609d7ad09baa43809933cd09bb32f2a0da9f70c3",
    "landing-light-a.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/nL7lSrHD36ZijT1hz2Ko/MNcuhCzMZRf8Mb2KBv83/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T164922Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=699af17cc5026b5ffe17bccecf186f531d4e732b4a4c115b1f9e6a6ff36bd07606bac679e180b261c0665955e9025801b7ffceaca9906364db0c75c40daaf8b1ad383bc790ec8f8015149a7e4816c80b87be6c2cfe94b0bbb4eb755b3ff9d32879bc892dd8513c96810b044f0d16cefe27848943fde642c0def785f3b58043ac43eec0b747066eee902adb5f270c153a72b39f5813fc4fe6a54d9974f37be08b016f41ed8e213f950531a5c95338b4d8085dbc8806a08b1345940643ba87d596f5c9a362c4620f73f1ecbe66588e9a013710d0ab9ca6cefe23cb30046a4ebf9a015430f415a69ea4b31353cc07545db75e22aefcbb1be79fe4cca9c58e283d0d",
    "landing-light-b.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/i48ERHv2iE0MbMrGcoOA/YfhJ9UnNcqWvmCRpE3Wp/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T164921Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=653a67d42d09a2effd3bfcb39915ae08fc1b481fddbb7796f59fe46d41c1f4f11e56f38f47379072bb903d446ad11e20a63bd594cc3803f944833a5058baea8748c73a7a82144bf39f23fa850179370bc5b9a4f8fbc2544246da76638d4a0bf6d5387b88bccae22fddb042721962e437c610585df5907ed0c184aafaa782cd3a8dd473507dcfbdb50b24551e20a56d5b6c4ddafc5de813ff981509714cbdf3d9dfb5a17a97d81271c99febcc3ac63cf78827219fb6a3fb328a8426f7d81f64970516e936145c4a61ce0e863c84dfcc62e7e59148780b49234626aace51ffcd44d6a0448d0b1d4f8415382db46316e2b20ba875f439099fb77215a2f1ba3f855b",
    "landing-heavy.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/wqig5ZNf1P1M5irKFkti/y3UVoBnV9M5sMWgsF7TO/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T165221Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=1a8fe18f8e1a02f09b59f5bfada01955f3144768dbf129596b184e52c1353bfdfbdf8ffa135c32a8642d2ab6ab9483d434b7b6e57b4309c953a1420307e89032ded5721fca527ac2931636b798995ada1fbb59d88c76166e896ecf71cfdada12bc504c6cd6b8a84e43996e3b96f67f8696695c0987ee14a9f20555fe74f4ae7e416fa590dcd0544e38f4a1a27e74740a379c663e55c1861de5c135654aba8041ddd03ef826f637052e40cbe91778401aca7540d8b8bd465a4b1a8fe836937b291f2887e679dfcd24aebaf479f6050869c35516862887df1727110ff54b220dbf8dc011c2a2b0dae47a205f5ffc8a7a8f6e68afc5a3d595a52e8e052f165dd1ca",
    "platform-lock-source.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/qyAmUe1aaP7VVOZ7cxac/Z2npCXKXZaXBOA3FQ0ug/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T164921Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=044c3ae933e93659df1cb978bcdf853389c734589f16bf0ba0c5ecb94d10eaf157779e2143bc333a4c3a41e5e7834e1929d81c839fc6e218064dd051f0f72f5e973da68e267a1210d061dbaf482e56a81f8ed361960d3bc3d0ef4fa6e60324a0eda3cce7635e12a800b2a811939448294acce19dcef5119733744164b82b339036b154f6a2be1ed106dd39c18e8c12fdbc739e4e09a8edfa73738b752a9514618e9f36483b3276d3c66a405bb633c04c36e3417367933a412a5c89b0289bd85798f25f55e7ed91162f01a0338dba92c9621e8d53977fb72a1e0c26b70d209ab6ab2b450b9dc40d3e3f69f63633025b3d395eebc01c17503a3628872129f5d212",
    "scope-engage.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/pFHCNzhhTQCuP5z6L9Lb/Eom088aUlO3WHaY6KxmP/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T164921Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=09031e892a2abf9e1842828a7826a5696771f383d58db8c8a6f5f7caafa6c65e03d384b22d8c73739166f00c80b4720babbdfb4787f01a68e147634a048694500db06cf57962fafdea97f87cd82852a5b96fecd75c187b221c9000f6a223d69327d9b2efa69004e211933869cbf0b35cbd78c228baaf4248558ab9bf24e428420414f514d4f13be7c321bdcb9effae0a6c0a6ee6f815c892da96fa21d6ab9c89cd6eaa61a62179ebf9422469512b3b4d46e00a97f278babae3747d1e4d48f2117372ecdc68b95840f38bcbd65569199c236f4df8d013eb24068ae1624e8f2c90e533bf3aa6df02c53db3e36297beb1e8b3538330fabf2d13fd3a4830ba254c98",
    "scope-disengage.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/chK8JP0W2SIKImaFPbJ4/ytqlIKAWBbgQFtHC7IK3/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T165049Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=6bf08691efd4e7acc276326efa7bf9c9ce73a091501388bd463fee6b7b11b101f4bb7c5d3bdea6b12d49f6f5da87dd1e018346331c4f03a86858d053b5b1776ed63430e586bed28e4e868e789a67f2653041bdd96e721e438433dcef86aa185f217cf3010dbcddc4a3ba4154700ca2aa82664ba58245a85b433b0d78cebe10f0f1285a7cdf3dc58fc59a6a78aa00fbd6bb31b6a35bed5c1a1560d39e1f59a94435d18b62226ab666b7c7f7192c6d483d75967644573c4843d7edb1e22c6eaffd5833998a52ed2073ea15616c8af1d4f881cbe80268ad6280bc9810ed5fbd84dd733a7cffb7826faac626e44457fde02f9dd985aeb10b2eaf4f6204034c3874c0",
    "crouch-down.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/cIIiaQ9IeKoT3JM1qeNs/SYFrf2tnPqBijwgTT3Qm/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T165049Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=44368612c4797e413ee3e049bbc2f401284fe2d7bc663711d03bb456e58987fdee1e522f392ef7f8bcb210209539bd62b5dad7df4990b9850f641c6426de52f5038910020133a0a8d3521f97b23b0bf405a2541a6b6595b7cea600ea254cd602f146bdece1b1c0337c03fd264c7355ffda78f039cf5eba59da87277608289de2c8f4be83097e79f23d92188a588a717d30b19ea9a4990b4d4d757a3f77241829328910912cbba1138a2be5da6e54b8bb83ee2939250ba283f6777bbd320b5389cb2a1bd9873689a9c96be5ab4b12c41b0e78b2f6b969fa1859b89af71c5c8291d1d8fbecf39f7beaaf19eb2c0fe28fabbca0cc779f0c0a2667e8c2a03e0e07ec",
    "crouch-up.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/wS3JmdQ1tIQS88HiuCrS/8H5RJbzJiDFBrEb6Cfxy/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T165638Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=2e1600b2ea456bffa88f844162e4cdda6ca67c8e4bdb0119752413290eaba6c36e3595f368331583542b47d4f5f1479d10ab76f1ef245e19ad8b4a4fec359752848403035639aa9457b1d810d078069e72e8a065e4c81f55576ee9e29d8c8fc766276324162941fb228bf9954b5cd47e62f4d80344dece5d5faf91ba9dd220c1d6ab9e64a4d17f8a99babd4e7f28b44012e6604c11595a6c45aab855e4a28fd0cfa99d42e92766441372d4e2e49372fefddf6853640f132742127cae381bbbd1c6892aecc3afd724f23709c36715979d33b883ab5746f84cce33927a5aa8838ff80a5c8c4f50391988d5b8fecd56a72df88decef8157c8435d6be8a8bc1b64d4",
    "platform-travel-source.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/EEVyl6t8yPqE8daa22s2/xoHBH0ci5krXSvgEGdy6/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T165654Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=14cc4c43fa40c2cb91ca00e0087064f6b4382b23f595295330719c3191f3f3a568e86f59867724f82c0a8f4e180a81d028eab1b5ce700d4640850502f14ac7e73d3393001f6f17aa4325fdfd7170d39e70d32fb14a24823ac9ec468d542d0f4d631c1f9902efa9f72a9ae3389da02631d069d52371ba1a72c2de1cde8dcb344c6e9e7a027ec987480c7ec418d0d986b6fbf8373b9eef8d9af79a35f05647e85d5ebf41f1d3d6e697b7fe45ce95ae7fae057364ce32bd014168dac52238aca89ba8e7724628c33143b2da66f592c54a8d2701752725f88917a668e4d8ca9d8d144e42f41aeabe2e0b86ced531b3507ff048867aa26ec0c68c77c62d01d8e71600",
    "construct-primary-source.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/wZfqaVBOHGJGPyn62J0c/KTKpZf6La69LJaIxvPZS/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T170340Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=b66c42e3cbcb68e2b40a08d70bcc2aea738177fdd4dd9eb5fdb80c66187933e0f53b0c9642239dccb68176426ed2bc5c101061de1a8c8862ca7b144d8ac101200cd18159e352502526d89c3e9e2b2363219520409ade58c547e57e6520dedd846e93bd63264c71990d0d9d6d748221eb43ba97071288af49c2d2fd8698a16c51ec7e16c039e004753ada612c1298ba034036012514e01f1f925e28bd70aa20771bdbe165ec01415680adc3a875ca5567c1a2b07560ce80961c0552c2fc35a10041c934a3de0222f80359386db375b749e328580aaf77582a07b6f283ef48bbced781fe25e640658e6a14dadfe98cc5f740a5b3a3375c60653e717277229743a6",
    "construct-low-source.mp3": "https://storage.googleapis.com/xi-backend/database/workspace/f41829bedd1d4e52996f820377c733a8/content_generation/dL87eeKXAGmiiwILpjhy/6US2iagSLc8rf4Dh7YCy/content.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=xi-backend-prod%40xi-labs.iam.gserviceaccount.com%2F20260915%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260915T170340Z&X-Goog-Expires=7200&X-Goog-SignedHeaders=host&X-Goog-Signature=7fce147e687d7da8ac63bf7253a6d09753c26ad00623fd195a37008dcf993a665c1205197c82b959a4ba60268473c4fa3dee68e31fdcb08fdadf5b8341d236819e75bb0ba29abf33a66bf25b092a21d40db1d1dac448b7b0da831797d4c752ec070a3b027a74caf18f83344742b3eb19f063742aadd95d766af2ce57de6378899b8fc32350d77333d5af7251b972297ca0c2f9e1bf89ae3865a310b2b4fcc279a4d6f7df8e1389fbc76e46c4ba910dc6e4bf906da3b8c78e201340d3a29c0db1a482baf0fd1b00ccd5af58f46f1c7070d2aea08c75f57fa0e4a3b2be5eba8528f64215d64e96cfe25b8fea787c8f26b3710cbdc24e7c6938869a8d4d4cfe3c9d",
}

for name, url in URLS.items():
    target = TMP / name
    print(f"download {name}")
    urllib.request.urlretrieve(url, target)

# Keep short player-owned one-shots as the generated MP3 bytes.
for name in [
    "footstep-run-a.mp3", "footstep-run-b.mp3",
    "footstep-crouch-a.mp3", "footstep-crouch-b.mp3",
    "landing-light-a.mp3", "landing-light-b.mp3", "landing-heavy.mp3",
    "scope-engage.mp3", "scope-disengage.mp3", "crouch-down.mp3", "crouch-up.mp3",
]:
    (AUDIO / name).write_bytes((TMP / name).read_bytes())

# Positional machinery is mono. Loops stay PCM WAV to avoid encoder priming gaps.
def ffmpeg(source: str, target: str, *, channels: int, rate: int = 24000) -> None:
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(TMP / source), "-ac", str(channels), "-ar", str(rate),
        "-c:a", "pcm_s16le", str(AUDIO / target)
    ], check=True)

ffmpeg("platform-lock-source.mp3", "platform-lock.wav", channels=1)
ffmpeg("platform-travel-source.mp3", "platform-travel.wav", channels=1)
ffmpeg("construct-primary-source.mp3", "construct-ambience-primary.wav", channels=2)
ffmpeg("construct-low-source.mp3", "construct-ambience-low.wav", channels=2)


def replace_once(path: str, old: str, new: str) -> None:
    file = ROOT / path
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1))


def regex_once(path: str, pattern: str, repl: str, flags: int = 0) -> None:
    file = ROOT / path
    text = file.read_text()
    new, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{path}: regex anchor matched {count}: {pattern[:80]!r}")
    file.write_text(new)


# ---------------------------------------------------------------------------
# Audio manifest: generated assets are checked-in prebuilt media. They remain in
# the canonical cue table but are not rebuilt from the external authored WAV drop.
# ---------------------------------------------------------------------------
replace_once(
    "src/audio/TraversalAudioManifest.ts",
    '  /** Path inside the authored `Traversal FPS SFX` drop. */\n  readonly source: string;\n',
    '  /** Path inside the authored `Traversal FPS SFX` drop. Omitted for checked-in generated media. */\n  readonly source?: string;\n  /** Checked-in generated media: audio:build verifies it instead of rebuilding it. */\n  readonly prebuilt?: boolean;\n  /** The supplied buffer was generated/edited to loop cleanly end-to-start. */\n  readonly seamless?: boolean;\n'
)
replace_once(
    "src/audio/TraversalAudioManifest.ts",
    '  | "landing.adjust"\n',
    '  | "landing.adjust"\n  | "movement.footstep"\n  | "movement.crouch-step"\n  | "movement.land-light"\n  | "movement.land-heavy"\n  | "movement.crouch-down"\n  | "movement.crouch-up"\n  | "scope.engage"\n  | "scope.disengage"\n  | "platform.travel"\n  | "platform.lock"\n  | "ambience.construct"\n  | "ambience.construct-low"\n'
)
asset_block = '''  // ---- Player body / traversal foley (ElevenLabs approved) --------------------
  { id: "footstep-run-a", file: "footstep-run-a.mp3", channels: 2, maxSeconds: 0.8, prebuilt: true },
  { id: "footstep-run-b", file: "footstep-run-b.mp3", channels: 2, maxSeconds: 0.8, prebuilt: true },
  { id: "footstep-crouch-a", file: "footstep-crouch-a.mp3", channels: 2, maxSeconds: 0.8, prebuilt: true },
  { id: "footstep-crouch-b", file: "footstep-crouch-b.mp3", channels: 2, maxSeconds: 0.8, prebuilt: true },
  { id: "landing-light-a", file: "landing-light-a.mp3", channels: 2, maxSeconds: 1.0, prebuilt: true },
  { id: "landing-light-b", file: "landing-light-b.mp3", channels: 2, maxSeconds: 1.0, prebuilt: true },
  { id: "landing-heavy", file: "landing-heavy.mp3", channels: 2, maxSeconds: 1.2, prebuilt: true },
  { id: "crouch-down", file: "crouch-down.mp3", channels: 2, maxSeconds: 0.7, prebuilt: true },
  { id: "crouch-up", file: "crouch-up.mp3", channels: 2, maxSeconds: 0.6, prebuilt: true },
  { id: "scope-engage", file: "scope-engage.mp3", channels: 2, maxSeconds: 0.5, prebuilt: true },
  { id: "scope-disengage", file: "scope-disengage.mp3", channels: 2, maxSeconds: 0.5, prebuilt: true },

  // ---- Generated world beds ---------------------------------------------------
  { id: "platform-travel", file: "platform-travel.wav", channels: 1, maxSeconds: 8.0, sampleRate: 24000, prebuilt: true, seamless: true },
  { id: "platform-lock", file: "platform-lock.wav", channels: 1, maxSeconds: 1.4, sampleRate: 24000, prebuilt: true },
  { id: "construct-ambience-primary", file: "construct-ambience-primary.wav", channels: 2, maxSeconds: 20.0, sampleRate: 24000, prebuilt: true, seamless: true },
  { id: "construct-ambience-low", file: "construct-ambience-low.wav", channels: 2, maxSeconds: 20.0, sampleRate: 24000, prebuilt: true, seamless: true },

'''
replace_once(
    "src/audio/TraversalAudioManifest.ts",
    '  // ---- Hazards (mono: spatialised) -------------------------------------------\n',
    asset_block + '  // ---- Hazards (mono: spatialised) -------------------------------------------\n'
)
movement_cues = '''  // --- Player body ---------------------------------------------------------------
  "movement.footstep": {
    bus: "sfx", tier: "core", gain: 0.55, pitchJitter: 0.035, cooldownMs: 90, maxVoices: 2,
    slots: [{ assets: ["footstep-run-a", "footstep-run-b"], pick: "cycle" }],
    visualPair: "Player is visibly moving across a platform. presentation-only."
  },
  "movement.crouch-step": {
    bus: "sfx", tier: "core", gain: 0.40, pitchJitter: 0.025, cooldownMs: 120, maxVoices: 2,
    slots: [{ assets: ["footstep-crouch-a", "footstep-crouch-b"], pick: "cycle" }],
    visualPair: "Player is visibly crouch-moving across a platform. presentation-only."
  },
  "movement.land-light": {
    bus: "sfx", tier: "core", gain: 0.62, pitchJitter: 0.02, cooldownMs: 120,
    slots: [{ assets: ["landing-light-a", "landing-light-b"], pick: "cycle" }],
    visualPair: "Camera/player motion visibly settles onto the platform. presentation-only."
  },
  "movement.land-heavy": {
    bus: "sfx", tier: "core", gain: 0.76, cooldownMs: 160,
    slots: [{ assets: ["landing-heavy"] }],
    visualPair: "A high-speed fall visibly ends on the platform. presentation-only."
  },
  "movement.crouch-down": {
    bus: "sfx", tier: "core", gain: 0.34, cooldownMs: 120,
    slots: [{ assets: ["crouch-down"] }],
    visualPair: "Camera height visibly lowers into crouch. presentation-only."
  },
  "movement.crouch-up": {
    bus: "sfx", tier: "core", gain: 0.32, cooldownMs: 120,
    slots: [{ assets: ["crouch-up"] }],
    visualPair: "Camera height visibly rises out of crouch. presentation-only."
  },
  "scope.engage": {
    bus: "sfx", tier: "core", gain: 0.44, cooldownMs: 80,
    slots: [{ assets: ["scope-engage"] }],
    visualPair: "Scope overlay and reduced FOV visibly engage. presentation-only."
  },
  "scope.disengage": {
    bus: "sfx", tier: "core", gain: 0.40, cooldownMs: 80,
    slots: [{ assets: ["scope-disengage"] }],
    visualPair: "Scope overlay and FOV visibly return to normal. presentation-only."
  },

'''
replace_once(
    "src/audio/TraversalAudioManifest.ts",
    '  // --- Utility actors: fairness-critical --------------------------------------\n',
    movement_cues + '  // --- Utility actors: fairness-critical --------------------------------------\n'
)
platform_cues = '''  "platform.travel": {
    bus: "world", tier: "deferred", gain: 0.28, positional: true, loop: true,
    slots: [{ assets: ["platform-travel"] }],
    visualPair: "The platform is visibly travelling through the room.",
    note: "Quiet magnetic glide follows the actual moving platform; it is not an activation substitute."
  },
  "platform.lock": {
    bus: "world", tier: "deferred", gain: 0.54, positional: true, cooldownMs: 140, maxVoices: 4,
    slots: [{ assets: ["platform-lock"] }],
    visualPair: "The moving platform visibly settles at an endpoint. presentation-only."
  },

'''
replace_once(
    "src/audio/TraversalAudioManifest.ts",
    '  // --- Sector exit -------------------------------------------------------------\n',
    platform_cues + '  // --- Sector exit -------------------------------------------------------------\n'
)
ambience_cues = '''  // --- Construct ambience --------------------------------------------------------
  "ambience.construct": {
    bus: "music", tier: "deferred", gain: 0.20, loop: true,
    slots: [{ assets: ["construct-ambience-primary"] }],
    visualPair: "presentation-only.",
    note: "Primary low-passed Construct bed; intentionally sparse so traversal cues retain priority."
  },
  "ambience.construct-low": {
    bus: "music", tier: "deferred", gain: 0.07, loop: true,
    slots: [{ assets: ["construct-ambience-low"] }],
    visualPair: "presentation-only.",
    note: "Second approved 20-second bed, deliberately kept very low in the mix."
  },

'''
replace_once(
    "src/audio/TraversalAudioManifest.ts",
    '  // --- Progression -------------------------------------------------------------\n',
    ambience_cues + '  // --- Progression -------------------------------------------------------------\n'
)

# Prebuilt assets are already normalized/checked into public/audio. audio:build
# must leave them alone while preserving the authored-drop workflow.
replace_once(
    "scripts/build-audio.ts",
    'function buildAsset(ffmpeg: string, sourceRoot: string, spec: AudioAssetSpec, scratch: string): number {\n  const sourcePath = join(sourceRoot, spec.source);\n  if (!existsSync(sourcePath)) throw new Error(`Missing source for "${spec.id}": ${sourcePath}`);\n',
    'function buildAsset(ffmpeg: string, sourceRoot: string, spec: AudioAssetSpec, scratch: string): number {\n  if (spec.prebuilt) {\n    const target = join(outputDir, spec.file);\n    if (!existsSync(target)) throw new Error(`Missing checked-in prebuilt asset for "${spec.id}": ${target}`);\n    const bytes = statSync(target).size;\n    console.log(`  ${spec.id.padEnd(28)} prebuilt  ${(bytes / 1024).toFixed(1)} KB`);\n    return bytes;\n  }\n  if (!spec.source) throw new Error(`Missing authored source path for "${spec.id}".`);\n  const sourcePath = join(sourceRoot, spec.source);\n  if (!existsSync(sourcePath)) throw new Error(`Missing source for "${spec.id}": ${sourcePath}`);\n'
)
replace_once(
    "scripts/audio-doctor.ts",
    '      if (asset && !asset.loopCrossfadeSeconds) {\n        fail(`"${event}" loops but "${assetId}" was not built with a seamless crossfade.`);\n      }\n',
    '      if (asset && !asset.loopCrossfadeSeconds && !asset.seamless) {\n        fail(`"${event}" loops but "${assetId}" is not marked seamless.`);\n      }\n'
)

# ---------------------------------------------------------------------------
# Shared Settings categorization: desktop and mobile consume one table. Unknown
# rows stay visible rather than silently falling into Display.
# ---------------------------------------------------------------------------
settings_schema = r'''export type SettingsTabId = "controls" | "audio" | "display" | "accessibility";

export const NIGHT_AUDIO_CHOICE = "traversal-night-audio";
export const PLAIN_FONT_CHOICE = "traversal-plain-font";

export const SETTINGS_TABS: ReadonlyArray<{
  id: SettingsTabId;
  label: string;
  choices: readonly string[];
}> = [
  {
    id: "controls",
    label: "Controls",
    choices: [
      "traversal-controls", "traversal-sensitivity", "traversal-controller-x",
      "traversal-controller-y", "traversal-controller-accel", "traversal-controller-scope",
      "traversal-controller-move-deadzone", "traversal-controller-deadzone",
      "traversal-invert-x", "traversal-invert-y", "traversal-crouch-mode",
      "traversal-aim-smoothing", "traversal-aim-assist", "traversal-controller-vibration"
    ]
  },
  {
    id: "audio",
    label: "Audio",
    choices: ["master-down", "master-up", "traversal-mono-audio", NIGHT_AUDIO_CHOICE]
  },
  {
    id: "display",
    label: "Display",
    choices: ["traversal-fov", "traversal-reticle-scale", "screen-shake", "fullscreen", "traversal-visual-lab"]
  },
  {
    id: "accessibility",
    label: "Accessibility",
    choices: [
      "traversal-reduce-flash", "traversal-reduce-motion", "traversal-color-profile",
      "traversal-hud-contrast", "traversal-ui-scale", "traversal-text-timing",
      "traversal-cvd-preview", PLAIN_FONT_CHOICE
    ]
  }
];

export const HIDDEN_SHELL_DUPLICATES = new Set(["reduced-motion", "vibration"]);

const TAB_FOR_CHOICE = new Map<string, SettingsTabId>(
  SETTINGS_TABS.flatMap((tab) => tab.choices.map((choice) => [choice, tab.id] as const))
);
const warned = new Set<string>();

export function resolveSettingsTab(id: string, label = ""): SettingsTabId | null {
  const explicit = TAB_FOR_CHOICE.get(id);
  if (explicit) return explicit;

  const text = `${id} ${label}`.toLowerCase();
  if (/(master|music|sfx|audio|volume|mute)/.test(text)) return "audio";
  if (/(access|reduced motion|reduce motion|flash|colour|color|contrast|timed text|font|cvd|ui scale)/.test(text)) return "accessibility";
  if (/(control|input|sensitivity|deadzone|invert|crouch|aim|vibration|binding|preset)/.test(text)) return "controls";
  if (/(display|fullscreen|fov|reticle|screen shake|visual)/.test(text)) return "display";

  if (id && !warned.has(id)) {
    warned.add(id);
    console.warn(`[Traversal settings] Unmapped row kept visible: ${id}`);
  }
  return null;
}
'''
(ROOT / "src/game/SettingsSchema.ts").write_text(settings_schema)

# Desktop: consume the shared table and never classify unknown rows as Display.
settings_tabs = ROOT / "src/game/SettingsTabsRuntime.ts"
text = settings_tabs.read_text()
text = text.replace(
    'import type { TraversalSettingsStore } from "./TraversalSettings";\n',
    'import type { TraversalSettingsStore } from "./TraversalSettings";\nimport { HIDDEN_SHELL_DUPLICATES, NIGHT_AUDIO_CHOICE, PLAIN_FONT_CHOICE, SETTINGS_TABS, resolveSettingsTab, type SettingsTabId } from "./SettingsSchema";\n'
)
text, count = re.subn(
    r'type SettingsTabId = "controls" \| "audio" \| "display" \| "accessibility";\n\n.*?const HIDDEN_SHELL_DUPLICATES = new Set\(\["reduced-motion", "vibration"\]\);\n',
    '', text, count=1, flags=re.S
)
if count != 1:
    raise RuntimeError("SettingsTabsRuntime: failed to remove duplicated schema")
text = text.replace("TABS", "SETTINGS_TABS")
text = text.replace("TAB_FOR_CHOICE.get(choiceId)", "resolveSettingsTab(choiceId)")
text = text.replace("TAB_FOR_CHOICE.get(id)", "resolveSettingsTab(id, choice.textContent ?? \"\")")
old = '    const tab = resolveSettingsTab(id, choice.textContent ?? "") ?? "display";\n    const visible = !duplicate && tab === activeTab;\n    button.dataset.settingsTab = tab;\n'
if old not in text:
    # The loop variable is named button in current main, not choice.
    old = '    const tab = resolveSettingsTab(id, button.textContent ?? "") ?? "display";\n    const visible = !duplicate && tab === activeTab;\n    button.dataset.settingsTab = tab;\n'
new = '    const tab = resolveSettingsTab(id, button.textContent ?? "");\n    const visible = !duplicate && (tab === null || tab === activeTab);\n    button.dataset.settingsTab = tab ?? "unmapped";\n'
if old not in text:
    raise RuntimeError("SettingsTabsRuntime: failed to find visibility fallback")
text = text.replace(old, new, 1)
settings_tabs.write_text(text)

# Mobile: same shared schema, same safe unknown-row behavior.
mobile = ROOT / "src/game/MobileSettingsRuntime.ts"
text = mobile.read_text()
text = text.replace(
    'import type { TraversalSettingsStore } from "./TraversalSettings";\n',
    'import type { TraversalSettingsStore } from "./TraversalSettings";\nimport { HIDDEN_SHELL_DUPLICATES, SETTINGS_TABS, resolveSettingsTab, type SettingsTabId } from "./SettingsSchema";\n'
)
text, count = re.subn(
    r'type SettingsTabId = "controls" \| "audio" \| "display" \| "accessibility";\n\n.*?const HIDDEN_SHELL_DUPLICATES = new Set\(\["reduced-motion", "vibration"\]\);\n',
    '', text, count=1, flags=re.S
)
if count != 1:
    raise RuntimeError("MobileSettingsRuntime: failed to remove duplicated schema")
text = text.replace("TABS", "SETTINGS_TABS")
old = '    const tab = TAB_FOR_CHOICE.get(id) ?? "display";\n    const visible = !duplicate && tab === activeTab;\n    button.hidden = !visible;\n'
new = '    const tab = resolveSettingsTab(id, button.textContent ?? "");\n    const visible = !duplicate && (tab === null || tab === activeTab);\n    button.dataset.settingsTab = tab ?? "unmapped";\n    button.hidden = !visible;\n'
if old not in text:
    raise RuntimeError("MobileSettingsRuntime: failed to find visibility fallback")
text = text.replace(old, new, 1)
mobile.write_text(text)

mobile_supplemental = r'''import { traversalAudioEngine } from "../audio/TraversalAudioEngine";
import { NIGHT_AUDIO_CHOICE, PLAIN_FONT_CHOICE } from "./SettingsSchema";

type FlowLike = { onActivate(screenId: string, choiceId: string): void };
type SupplementalSettings = { nightAudio: boolean; plainFont: boolean; firstRunAccessibilitySeen: boolean };

const KEY = "traversal-fps:supplemental-accessibility:v1";
let value = load();

export function installMobileSupplementalSettingsRuntime(flow: FlowLike, root: HTMLElement): void {
  apply();
  injectStyle();
  const originalActivate = flow.onActivate.bind(flow);

  flow.onActivate = (screenId: string, choiceId: string) => {
    if (screenId === "settings" && choiceId === NIGHT_AUDIO_CHOICE) {
      value.nightAudio = !value.nightAudio;
      save(); apply(); decorate(root, flow); return;
    }
    if (screenId === "settings" && choiceId === PLAIN_FONT_CHOICE) {
      value.plainFont = !value.plainFont;
      save(); apply(); decorate(root, flow); return;
    }
    originalActivate(screenId, choiceId);
    if (choiceId === "settings" || screenId === "settings") requestAnimationFrame(() => decorate(root, flow));
  };

  const observer = new MutationObserver(() => {
    if (root.querySelector('[data-screen-id="settings"]')) requestAnimationFrame(() => decorate(root, flow));
  });
  observer.observe(root, { childList: true, subtree: true });
  requestAnimationFrame(() => decorate(root, flow));
  window.addEventListener("beforeunload", () => observer.disconnect(), { once: true });
}

function decorate(root: HTMLElement, flow: FlowLike): void {
  const choices = root.querySelector<HTMLElement>('[data-screen-id="settings"] .slu-choices');
  if (!choices) return;
  ensureChoice(choices, NIGHT_AUDIO_CHOICE, `Dynamic Range: ${value.nightAudio ? "Night" : "Full"}`, "Night mode compresses loud peaks", flow);
  ensureChoice(choices, PLAIN_FONT_CHOICE, `Plain Font: ${value.plainFont ? "On" : "Off"}`, "Uses a conventional system sans-serif for interface text", flow);
  setLabel(choices, NIGHT_AUDIO_CHOICE, `Dynamic Range: ${value.nightAudio ? "Night" : "Full"}`);
  setLabel(choices, PLAIN_FONT_CHOICE, `Plain Font: ${value.plainFont ? "On" : "Off"}`);
}

function ensureChoice(choices: HTMLElement, id: string, label: string, description: string, flow: FlowLike): void {
  if (choices.querySelector(`[data-choice-id="${id}"]`)) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "slu-choice";
  button.dataset.choiceId = id;
  const labelNode = document.createElement("span");
  labelNode.className = "slu-choice-label";
  labelNode.textContent = label;
  const desc = document.createElement("span");
  desc.className = "slu-choice-desc";
  desc.textContent = description;
  button.append(labelNode, desc);
  button.addEventListener("click", () => flow.onActivate("settings", id));
  choices.appendChild(button);
}

function setLabel(root: HTMLElement, id: string, label: string): void {
  const node = root.querySelector<HTMLElement>(`[data-choice-id="${id}"] .slu-choice-label`);
  if (node) node.textContent = label;
}

function apply(): void {
  document.body.classList.toggle("traversal-plain-font", value.plainFont);
  traversalAudioEngine.setNightMode(value.nightAudio);
}

function load(): SupplementalSettings {
  const defaults: SupplementalSettings = { nightAudio: false, plainFont: false, firstRunAccessibilitySeen: false };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<SupplementalSettings>) } : defaults;
  } catch { return defaults; }
}

function save(): void {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* optional preference */ }
}

function injectStyle(): void {
  if (document.getElementById("traversal-mobile-plain-font-style")) return;
  const style = document.createElement("style");
  style.id = "traversal-mobile-plain-font-style";
  style.textContent = `
    body.traversal-plain-font .slu-screen,
    body.traversal-plain-font #hud,
    body.traversal-plain-font #tutorial-card,
    body.traversal-plain-font #capture-hint,
    body.traversal-plain-font #mobile-controls,
    body.traversal-plain-font #visual-lab { font-family: Arial, Helvetica, system-ui, sans-serif !important; letter-spacing: normal !important; }
    body.traversal-plain-font .slu-screen *, body.traversal-plain-font #hud *, body.traversal-plain-font #tutorial-card * { font-family: inherit !important; }
  `;
  document.head.appendChild(style);
}
'''
(ROOT / "src/game/MobileSupplementalSettingsRuntime.ts").write_text(mobile_supplemental)
replace_once(
    "src/game/SettingsFocusRuntime.ts",
    'import { installMobileSettingsRuntime } from "./MobileSettingsRuntime";\n',
    'import { installMobileSettingsRuntime } from "./MobileSettingsRuntime";\nimport { installMobileSupplementalSettingsRuntime } from "./MobileSupplementalSettingsRuntime";\n'
)
replace_once(
    "src/game/SettingsFocusRuntime.ts",
    '  if (touchFirst) {\n    installMobileSettingsRuntime(flow, ui, root, settings);\n',
    '  if (touchFirst) {\n    installMobileSupplementalSettingsRuntime(flow, root);\n    installMobileSettingsRuntime(flow, ui, root, settings);\n'
)

# ---------------------------------------------------------------------------
# Runtime foley, machinery, ambience.
# ---------------------------------------------------------------------------
movement_audio = r'''import * as THREE from "three";
import { emitTraversalAudio } from "../audio/TraversalAudio";

type RuntimeState = {
  camera: THREE.PerspectiveCamera;
  velocityY: number;
  input: { movement(): { x: number; z: number } };
  warp?: { isTransiting?(): boolean };
  updateMovement(dt: number, now: number): void;
  loadRoom(index: number): void;
};

export function installMovementAudioRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const originalMove = state.updateMovement.bind(game);
  let initialized = false;
  let wasAirborne = false;
  let wasCrouching = false;
  let stepDistance = 0;
  let peakFallSpeed = 0;

  state.updateMovement = (dt: number, now: number) => {
    const before = state.camera.position.clone();
    const beforeVelocityY = state.velocityY;
    const intent = state.input.movement();
    originalMove(dt, now);

    const body = document.body;
    const airborne = body.classList.contains("airborne");
    const crouching = body.classList.contains("crouching");
    const transit = Boolean(state.warp?.isTransiting?.());
    const warpPresentation = transit || body.classList.contains("warp-committed") || body.classList.contains("rewinding") || body.classList.contains("warp-arrival");

    if (!initialized) {
      initialized = true;
      wasAirborne = airborne;
      wasCrouching = crouching;
      return;
    }

    if (airborne) peakFallSpeed = Math.max(peakFallSpeed, Math.max(0, -beforeVelocityY, -state.velocityY));

    if (wasAirborne && !airborne) {
      if (!warpPresentation && peakFallSpeed >= 2.4) {
        emitTraversalAudio(peakFallSpeed >= 7.25 ? "movement.land-heavy" : "movement.land-light");
      }
      peakFallSpeed = 0;
      stepDistance = 0;
    }

    if (wasCrouching !== crouching && !airborne && !warpPresentation) {
      emitTraversalAudio(crouching ? "movement.crouch-down" : "movement.crouch-up");
    }

    const dx = state.camera.position.x - before.x;
    const dz = state.camera.position.z - before.z;
    const travelled = Math.hypot(dx, dz);
    const hasIntent = Math.hypot(intent.x, intent.z) > 0.14;
    if (!airborne && !warpPresentation && hasIntent && travelled < 1.5) {
      stepDistance += travelled;
      const stride = crouching ? 1.05 : 1.58;
      if (stepDistance >= stride) {
        stepDistance %= stride;
        emitTraversalAudio(crouching ? "movement.crouch-step" : "movement.footstep");
      }
    } else if (airborne || warpPresentation || travelled >= 1.5) {
      stepDistance = 0;
    }

    wasAirborne = airborne;
    wasCrouching = crouching;
  };

  const originalLoadRoom = state.loadRoom.bind(game);
  state.loadRoom = (index: number) => {
    originalLoadRoom(index);
    initialized = false;
    stepDistance = 0;
    peakFallSpeed = 0;
  };
}
'''
(ROOT / "src/game/MovementAudioRuntime.ts").write_text(movement_audio)

platform_audio = r'''import * as THREE from "three";
import { emitTraversalAudioAt, startTraversalAudioLoop, type TraversalAudioLoopHandle } from "../audio/TraversalAudio";

type RuntimeState = { platformMeshes: THREE.Mesh[]; update(dt: number): void };
type Track = { position: THREE.Vector3; loop: TraversalAudioLoopHandle | null; moving: boolean; quietFrames: number };

export function installPlatformMotionAudioRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  const originalUpdate = state.update.bind(game);
  const tracks = new Map<string, Track>();
  const world = new THREE.Vector3();

  state.update = (dt: number) => {
    originalUpdate(dt);
    const live = new Set<string>();
    const safeDt = Math.max(1 / 240, Math.min(0.1, dt || 1 / 60));

    for (const mesh of state.platformMeshes ?? []) {
      const id = mesh.uuid;
      live.add(id);
      mesh.getWorldPosition(world);
      let track = tracks.get(id);
      if (!track) {
        tracks.set(id, { position: world.clone(), loop: null, moving: false, quietFrames: 0 });
        continue;
      }

      const distance = track.position.distanceTo(world);
      const speed = distance / safeDt;
      track.position.copy(world);

      // Room rebuilds/teleports are not physical platform travel.
      if (distance > 2.5) {
        track.loop?.stop();
        track.loop = null;
        track.moving = false;
        track.quietFrames = 0;
        continue;
      }

      if (speed > 0.045) {
        track.quietFrames = 0;
        track.moving = true;
        if (!track.loop) track.loop = startTraversalAudioLoop("platform.travel", world);
        track.loop?.setPosition(world.x, world.y, world.z);
        track.loop?.setIntensity(Math.max(0.28, Math.min(1, speed / 4.5)));
      } else if (track.moving) {
        track.quietFrames += 1;
        if (track.quietFrames >= 3) {
          track.loop?.stop();
          track.loop = null;
          track.moving = false;
          track.quietFrames = 0;
          emitTraversalAudioAt("platform.lock", world);
        }
      }
    }

    for (const [id, track] of tracks) {
      if (live.has(id)) continue;
      track.loop?.stop();
      tracks.delete(id);
    }
  };
}
'''
(ROOT / "src/game/PlatformMotionAudioRuntime.ts").write_text(platform_audio)

ambience = r'''import { startTraversalAudioLoop, type TraversalAudioLoopHandle } from "../audio/TraversalAudio";

type RuntimeState = { shell: { events: { on(event: string, handler: () => void): void } } };

export function installConstructAmbienceRuntime(game: object): void {
  const state = game as unknown as RuntimeState;
  let primary: TraversalAudioLoopHandle | null = null;
  let low: TraversalAudioLoopHandle | null = null;
  let restoreTimer = 0;

  const setMix = (a: number, b: number) => {
    primary?.setIntensity(a);
    low?.setIntensity(b);
  };

  const start = () => {
    if (primary || low) return;
    primary = startTraversalAudioLoop("ambience.construct", { x: 0, y: 0, z: 0 });
    low = startTraversalAudioLoop("ambience.construct-low", { x: 0, y: 0, z: 0 });
    setMix(0.12, 0.08);
    window.setTimeout(() => setMix(1, 1), 650);
  };

  const stop = () => {
    window.clearTimeout(restoreTimer);
    primary?.stop();
    low?.stop();
    primary = null;
    low = null;
  };

  state.shell.events.on("level:loaded", start);
  state.shell.events.on("game:quit", stop);

  window.addEventListener("traversal:audio", (raw) => {
    if (!primary && !low) return;
    const event = (raw as CustomEvent<{ event?: string }>).detail?.event ?? "";
    if (event.startsWith("ambience.")) return;
    if (!/^(rifle\.fire|warp\.|rewind\.|hazard\.|exit\.|sector\.)/.test(event)) return;
    setMix(0.68, 0.48);
    window.clearTimeout(restoreTimer);
    restoreTimer = window.setTimeout(() => setMix(1, 1), 720);
  });
}
'''
(ROOT / "src/game/ConstructAmbienceRuntime.ts").write_text(ambience)

# Scope toggle SFX. Forced cleanup when leaving gameplay stays silent.
replace_once(
    "src/game/ScopeRuntime.ts",
    'import * as THREE from "three";\n',
    'import * as THREE from "three";\nimport { emitTraversalAudio } from "../audio/TraversalAudio";\n'
)
replace_once(
    "src/game/ScopeRuntime.ts",
    '  const setScoped = (next: boolean) => {\n    scoped = next;\n    document.body.classList.toggle("scope-active", scoped);\n    window.dispatchEvent(new CustomEvent("traversal:scope-change", { detail: { active: scoped } }));\n  };\n',
    '  const setScoped = (next: boolean, audible = true) => {\n    if (next === scoped) return;\n    scoped = next;\n    document.body.classList.toggle("scope-active", scoped);\n    window.dispatchEvent(new CustomEvent("traversal:scope-change", { detail: { active: scoped } }));\n    if (audible) emitTraversalAudio(scoped ? "scope.engage" : "scope.disengage");\n  };\n'
)
replace_once(
    "src/game/ScopeRuntime.ts",
    '    if (!document.body.classList.contains("playing") && scoped) setScoped(false);\n',
    '    if (!document.body.classList.contains("playing") && scoped) setScoped(false, false);\n'
)

# Wire runtimes late enough to observe the final combined input/update stream.
replace_once(
    "src/main.ts",
    'import { installScopeRuntime } from "./game/ScopeRuntime";\n',
    'import { installScopeRuntime } from "./game/ScopeRuntime";\nimport { installMovementAudioRuntime } from "./game/MovementAudioRuntime";\nimport { installPlatformMotionAudioRuntime } from "./game/PlatformMotionAudioRuntime";\nimport { installConstructAmbienceRuntime } from "./game/ConstructAmbienceRuntime";\n'
)
replace_once(
    "src/main.ts",
    'installOnboardingRuntime(game, contentRuntime);\ninstallEditorShortcut();\n',
    'installOnboardingRuntime(game, contentRuntime);\ninstallMovementAudioRuntime(game);\ninstallPlatformMotionAudioRuntime(game);\ninstallConstructAmbienceRuntime(game);\ninstallEditorShortcut();\n'
)
replace_once(
    "src/main.ts",
    '  audio: "authored SFX through shared master/music/sfx buses // positional hazard + exit cues // procedural fallback retained",\n',
    '  audio: "authored + approved generated SFX through shared buses // movement foley // moving-platform bed // Construct ambience // positional hazards",\n'
)

# Claude finding #1 was already fixed on current main by GamepadGameplayRuntime's
# flashMessage wrapper. Do not add a second scaler; that would multiply Timed Text twice.

# Ignore both real node_modules directories and temporary symlink installs.
gitignore = ROOT / ".gitignore"
gitignore.write_text(gitignore.read_text().replace("node_modules/\n", "node_modules\n", 1))

print("Traversal audio/settings patch applied")
