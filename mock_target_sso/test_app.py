import unittest
from unittest.mock import patch

import app as target_sso


class TargetSsoTest(unittest.TestCase):
    def setUp(self):
        target_sso.app.config.update(TESTING=True, SECRET_KEY="test-secret")
        self.client = target_sso.app.test_client()

    def test_sso_login_establishes_target_session(self):
        identity = {"userId": "admin", "name": "管理员", "uuid": "test-uuid"}
        with patch.object(target_sso, "verify_ticket", return_value=identity) as verify:
            response = self.client.get("/sso/login?ssoCode=mock_target&ticket=one-time-ticket")

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/")
        verify.assert_called_once_with("one-time-ticket")
        home = self.client.get("/")
        self.assertIn("admin", home.get_data(as_text=True))

    def test_sso_login_rejects_wrong_code(self):
        response = self.client.get("/sso/login?ssoCode=other&ticket=one-time-ticket")
        self.assertEqual(response.status_code, 400)

    def test_failed_verification_clears_session(self):
        with patch.object(target_sso, "verify_ticket", side_effect=ValueError("Ticket 已使用")):
            response = self.client.get("/sso/login?ssoCode=mock_target&ticket=old-ticket")
        self.assertEqual(response.status_code, 401)
        self.assertIn("Ticket 已使用", response.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()
