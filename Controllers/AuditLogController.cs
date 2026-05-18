using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    public class AuditLogController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Audit Log";
            ViewData["Active"] = "AuditLog";
            return View();
        }
    }
}
