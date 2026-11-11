"""The read-only guard: four paths are allowed, and everything else is refused."""

from custom_components.ezgeyser.guard import ALLOWED_PATHS, RequestRefused, check_request, lan_host, url_for
import pytest

HOST = "http://192.168.50.51"
# Other read-only endpoints of the firmware, which this integration does not need, and made-up paths. The guard is an
# allow-list, so any path not on it is refused; no control endpoint is named in this repository.
FORBIDDEN_PATHS = ["/liveData", "/wifiData", "/wifiStatus", "/", "/anything", "/set", "/control"]


def test_allowed_paths_are_the_four_this_integration_reads() -> None:
    assert frozenset({"/quickStatus", "/data", "/cloudStatus", "/api/schedules"}) == ALLOWED_PATHS


@pytest.mark.parametrize("path", sorted(ALLOWED_PATHS))
def test_get_to_an_allowed_path_is_allowed(path: str) -> None:
    check_request("GET", f"{HOST}{path}")


@pytest.mark.parametrize("path", FORBIDDEN_PATHS)
def test_every_other_path_is_refused(path: str) -> None:
    with pytest.raises(RequestRefused, match="read-only list"):
        check_request("GET", f"{HOST}{path}")


@pytest.mark.parametrize(
    ("method", "url", "reason"),
    [
        ("POST", f"{HOST}/quickStatus", "only GET"),
        ("GET", f"{HOST}/quickStatus?x=1", "query"),
        ("GET", f"{HOST}/quickStatus#a", "query"),
        ("GET", "https://192.168.50.51/quickStatus", "plain HTTP"),
        ("GET", "http://user@192.168.50.51/quickStatus", "credentials"),
        ("GET", "http://8.8.8.8/quickStatus", "local-network"),
        ("GET", "http://example.com/quickStatus", "local-network"),
        ("GET", f"{HOST}:8080/quickStatus", "port 80"),
        ("GET", f"{HOST}/quickstatus", "read-only list"),
        ("GET", f"{HOST}/quickStatus/../control", "read-only list"),
    ],
)
def test_requests_off_the_rules_are_refused(method: str, url: str, reason: str) -> None:
    with pytest.raises(RequestRefused, match=reason):
        check_request(method, url)


@pytest.mark.parametrize(
    ("text", "host"),
    [
        ("192.168.50.51", "192.168.50.51"), (" 10.0.0.7\n", "10.0.0.7"), ("172.16.0.1", "172.16.0.1"),
        ("169.254.1.2", "169.254.1.2"), ("EZGEYSER-70041D123456.local", "ezgeyser-70041d123456.local"),
    ],
)  # fmt: skip
def test_lan_host_accepts_private_ipv4_and_local_names(text: str, host: str) -> None:
    assert lan_host(text) == host


@pytest.mark.parametrize(
    "text",
    [
        "8.8.8.8", "172.32.0.1", "192.168.01.1", "192.168.1", "example.com", "localhost", "http://192.168.1.1",
        "192.168.1.1:80", "192.168.1.1/x", "geyserK.local", "０.０.０.０", "", "::1",
    ],
)  # fmt: skip
def test_lan_host_refuses_everything_else(text: str) -> None:
    assert lan_host(text) is None


def test_url_for_refuses_a_public_host() -> None:
    with pytest.raises(RequestRefused):
        url_for("8.8.8.8", "/quickStatus")
