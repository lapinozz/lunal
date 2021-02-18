#include <iostream>

#include <cpr/cpr.h>
#include <json.hpp>

#include <cryptlite/base64.h>
#include <cryptlite/sha1.h>
#include <cryptlite/sha256.h>
#include <cryptlite/hmac.h>
#include <boost/cstdint.hpp>

using namespace cryptlite;

#include <memory>
#include "server_ws.hpp"

#include <fstream>
#include <string>

using json = nlohmann::json;

using namespace std;

using WsServer = SimpleWeb::SocketServer<SimpleWeb::WS>;

std::string secretKey = "NhqPtmdSJYdKjVHjA7PZj4Mge3R5YNiP1e3UZjInClVN65XAbvqqM6A7H5fATj0j";
std::string publicKey = "vmPUZE6mv9SD5VNHk4HlWFsOr6aKE2zvsw0MuIgwCIPy6utIco14y7Ju91duEh8A";
const std::string binanceUrl = "https://api.binance.com";

const auto MSG_FEES = "fees";
const auto MSG_KLINES = "klines";
const auto MSG_EXCHANGE_INFO = "exchange-info";

cpr::Response queryBinance(const std::string& endpoint, std::string queryString)
{
	if (queryString.length() > 0)
	{
		const std::string signature = hmac<sha256>::calc_hex(queryString, secretKey);
		queryString = "?" + queryString + "&signature=" + signature;
	}

	std::string url = binanceUrl + endpoint + queryString;

	auto response = cpr::Get(cpr::Url{ url },
						  cpr::Header{ {"X-MBX-APIKEY", publicKey} });
	return response;
}

int main(int argc, char** argv)
{
	std::ifstream secretKeyFile("./secret.key");
	std::getline(secretKeyFile, secretKey);

	std::ifstream publicKeyFile("./public.key");
	std::getline(publicKeyFile, publicKey);

	WsServer server;
	server.config.port = 8080;

	// Example 1: echo WebSocket endpoint
	// Added debug messages for example use of the callbacks
	// Test with the following JavaScript:
	//   var ws=new WebSocket("ws://localhost:8080/echo");
	//   ws.onmessage=function(evt){console.log(evt.data);};
	//   ws.send("test");
	auto& echo = server.endpoint["^/echo/?$"];

	const auto& doQuery = [&](const std::string& message)
	{
		const auto query = nlohmann::json::parse(message);

		std::cout << query["type"] << std::endl;
		const string& type = query["type"];

		cpr::Response response;

		nlohmann::json header = query;

		if (type == MSG_EXCHANGE_INFO)
		{
			response = cpr::Get(cpr::Url{ "https://api.binance.com/api/v3/exchangeInfo" });
		}
		else if (type == MSG_KLINES)
		{
			const string& symbol = query["symbol"];
			const string& interval = query["interval"];
			response = cpr::Get(cpr::Url{ "https://api.binance.com/api/v3/klines?symbol=" + symbol + "&interval=" + interval });
		}
		else if (type == MSG_FEES)
		{
			const string& timestamp = query["timestamp"];
			response = queryBinance("/wapi/v3/tradeFee.html", "timestamp=" + timestamp);
		}

		for (const auto header : response.header)
		{
			//std::cout << header.first << ": " << header.second << std::endl;
		}

		const auto data = json::parse(response.text);

		return json{header, data}.dump(4);
	};

	echo.on_message = [&](shared_ptr<WsServer::Connection> connection, shared_ptr<WsServer::InMessage> in_message) {
		const auto& message = in_message->string();
		const auto query = nlohmann::json::parse(message);

		connection->send(doQuery(message));
	};

	echo.on_open = [](shared_ptr<WsServer::Connection> connection) {
		cout << "Server: Opened connection " << connection.get() << endl;
	};

	// See RFC 6455 7.4.1. for status codes
	echo.on_close = [](shared_ptr<WsServer::Connection> connection, int status, const string& /*reason*/) {
		cout << "Server: Closed connection " << connection.get() << " with status code " << status << endl;
	};

	// Can modify handshake response headers here if needed
	echo.on_handshake = [](shared_ptr<WsServer::Connection> /*connection*/, SimpleWeb::CaseInsensitiveMultimap& /*response_header*/) {
		return SimpleWeb::StatusCode::information_switching_protocols; // Upgrade to websocket
	};

	// See http://www.boost.org/doc/libs/1_55_0/doc/html/boost_asio/reference.html, Error Codes for error code meanings
	echo.on_error = [](shared_ptr<WsServer::Connection> connection, const SimpleWeb::error_code& ec) {
		cout << "Server: Error in connection " << connection.get() << ". "
			<< "Error: " << ec << ", error message: " << ec.message() << endl;
	};
	// Start server and receive assigned port when server is listening for requests
	promise<unsigned short> server_port;
	thread server_thread([&server, &server_port]() {
		// Start server
		server.start([&server_port](unsigned short port) {
			server_port.set_value(port);
			});
		});
	cout << "Server listening on port " << server_port.get_future().get() << endl
		<< endl;

	//server_thread.join();

	std::cin.get();
}
