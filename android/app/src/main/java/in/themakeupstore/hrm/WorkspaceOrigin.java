package in.themakeupstore.hrm;

import java.net.URI;

/** Keep native affordances scoped to the configured workspace origin. */
final class WorkspaceOrigin {
    private final URI origin;

    WorkspaceOrigin(String url) {
        origin = URI.create(url);
    }

    boolean contains(String url) {
        if (url == null) return false;
        try {
            URI candidate = URI.create(url);
            return "https".equalsIgnoreCase(candidate.getScheme()) && candidate.getUserInfo() == null
                && origin.getHost().equalsIgnoreCase(candidate.getHost()) && port(origin) == port(candidate);
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    boolean isHome(String url) {
        if (!contains(url)) return true;
        String path = URI.create(url).getPath().replaceAll("/+$", "");
        return path.isEmpty() || path.equals("/login") || path.equals("/employee") || path.equals("/admin");
    }

    boolean allowsCamera(String requestingOrigin, String currentPage, String[] resources) {
        return contains(requestingOrigin) && contains(currentPage) && resources != null && resources.length == 1
            && "android.webkit.resource.VIDEO_CAPTURE".equals(resources[0]);
    }

    private static int port(URI uri) { return uri.getPort() < 0 ? 443 : uri.getPort(); }
}
