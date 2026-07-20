using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using EMS.Web.Models;

namespace EMS.Web.Controllers;

public class HomeController : Controller
{
    public IActionResult Index()    
    {
        Response.Cookies.Delete("ems_jwt", new CookieOptions { Path = "/" });
        Response.Cookies.Delete("ems_login_session", new CookieOptions { Path = "/" });
        Response.Cookies.Delete("ems_csrf", new CookieOptions { Path = "/" });
        return View();
    }

    public IActionResult Register() 
    {
        return View();
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
