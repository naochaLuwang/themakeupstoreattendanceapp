package in.themakeupstore.hrm;

import org.junit.Test;
import static org.junit.Assert.*;

public class WorkspaceOriginTest {
    private final WorkspaceOrigin origin = new WorkspaceOrigin("https://attendance.example.com");

    @Test public void acceptsOnlyTheConfiguredHttpsOrigin() {
        assertTrue(origin.contains("https://attendance.example.com/employee?month=1"));
        assertTrue(origin.contains("https://ATTENDANCE.example.com:443/login"));
        assertFalse(origin.contains("http://attendance.example.com/employee"));
        assertFalse(origin.contains("https://attendance.example.com.evil.invalid"));
        assertFalse(origin.contains("https://attendance.example.com:444/employee"));
        assertFalse(origin.contains("https://other.example.com"));
        assertFalse(origin.contains("https://staff@attendance.example.com"));
        assertFalse(origin.contains("javascript:alert(1)"));
        assertFalse(origin.contains("file:///private/report.pdf"));
        assertFalse(origin.contains(null));
    }

    @Test public void rootScreensBackgroundTheTaskInsteadOfReturningToLoginHistory() {
        for (String path : new String[]{"", "/", "/login", "/employee", "/employee/", "/admin", "/admin/?tab=1"})
            assertTrue(path, origin.isHome("https://attendance.example.com" + path));
        assertFalse(origin.isHome("https://attendance.example.com/employee/profile"));
        assertFalse(origin.isHome("https://attendance.example.com/admin/weekoff-request"));
    }

    @Test public void cameraRequiresTheWorkspacePageAndOriginWithNoOtherResources() {
        String page = "https://attendance.example.com/employee/smart-scan";
        String[] camera = {"android.webkit.resource.VIDEO_CAPTURE"};
        assertTrue(origin.allowsCamera("https://attendance.example.com", page, camera));
        assertFalse(origin.allowsCamera("https://other.example.com", page, camera));
        assertFalse(origin.allowsCamera("https://attendance.example.com", "https://other.example.com", camera));
        assertFalse(origin.allowsCamera("https://attendance.example.com", page, new String[]{"android.webkit.resource.AUDIO_CAPTURE"}));
        assertFalse(origin.allowsCamera("https://attendance.example.com", page, new String[]{"android.webkit.resource.VIDEO_CAPTURE", "unknown"}));
        assertFalse(origin.allowsCamera("https://attendance.example.com", page, null));
    }
}
