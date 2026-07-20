using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
    public class EmployeesController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Employees";
            ViewData["Active"] = "Employees";
            return View();
        }

        public IActionResult Create()
        {
            ViewData["Title"] = "Add Employee";
            ViewData["Active"] = "Employees";
            return View();
        }

        public IActionResult Details(string id = "")
        {
            ViewData["Title"] = "Employee Details";
            ViewData["Active"] = "Employees";
            ViewData["EmployeeId"] = id;
            return View();
        }
    }
}
