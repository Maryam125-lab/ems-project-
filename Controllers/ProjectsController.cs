using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers
{
    [Authorize]
    public class ProjectsController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Project Management";
            ViewData["Active"] = "Projects";
            return View();
        }
    }
}
