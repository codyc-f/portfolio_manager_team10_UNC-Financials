from flask import Flask
app = Flask(__name__)

@app.route("/")
def hello():
    return "Hello, World!"

@app.route("/api/portfolios", methods=["POST"])
def create_portfolio():
    # Logic to create a portfolio would go here
    return {"message": "Portfolio created successfully"}, 201

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
