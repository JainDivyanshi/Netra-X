import requests

# 🔗 Change this to your running server URL
URL = "https://masterank-netra-x-modelapi.hf.space/match"  
# For Hugging Face:
# URL = "https://your-username-your-space.hf.space/match"

# 🖼️ Path to your test sketch image
IMAGE_PATH = r"D:\Python\Netra-X\Backend\ml\dataset\image6.jpeg"

def test_match():
    with open(IMAGE_PATH, "rb") as f:
        files = {
            "file": ("test_sketch.png", f, "image/png")
        }

        response = requests.post(URL, files=files)

    print("Status Code:", response.status_code)

    try:
        data = response.json()
        print("\n✅ Response JSON:")
        print(data)
    except Exception:
        print("❌ Failed to parse JSON")
        print(response.text)


if __name__ == "__main__":
    test_match()