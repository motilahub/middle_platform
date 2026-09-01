import unittest
from urllib.parse import parse_qs, urlsplit

import app as mock_sso


class MockSsoTest(unittest.TestCase):
    def setUp(self):
        mock_sso.app.config.update(TESTING=True)
        mock_sso._tickets.clear()
        self.client = mock_sso.app.test_client()

    def test_ticket_is_exchanged_once(self):
        response = self.client.post("/sso/login", data={"user_id": "admin"})
        self.assertEqual(response.status_code, 302)
        query = parse_qs(urlsplit(response.headers["Location"]).query)
        self.assertEqual(query["ssoCode"], ["mock_oa"])
        ticket = query["ticket"][0]

        verified = self.client.post("/api/tickets/verify", json={"ticket": ticket})
        self.assertEqual(verified.status_code, 200)
        self.assertEqual(verified.get_json()["userId"], "admin")

        reused = self.client.post("/api/tickets/verify", json={"ticket": ticket})
        self.assertEqual(reused.status_code, 401)


if __name__ == "__main__":
    unittest.main()
