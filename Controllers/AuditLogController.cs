using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
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