using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
    public class PayrollController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Payroll";
            ViewData["Active"] = "Payroll";
            return View();
        }

        public IActionResult Report()
        {
            ViewData["Title"] = "Payroll Report";
            ViewData["Active"] = "Payroll";
            return View();
        }
    }
}
