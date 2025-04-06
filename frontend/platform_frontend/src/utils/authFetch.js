// IF TOKEN IS EXPIRED REDIRECTING TO LOGIN PAGE
export const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
  
    if (!options.headers) {
      options.headers = {};
    }
  
    options.headers['Authorization'] = `Bearer ${token}`;
    options.headers['Content-Type'] = 'application/json';
  
    try {
      const res = await fetch(url, options);
  
      if (res.status === 401) {
        const data = await res.json();
        if (
          data?.Error?.includes("Token has expired") ||
          data?.Error?.includes("Invalid token") ||
          data?.error?.includes("Token has expired") ||
          data?.error?.includes("Invalid token")
        ) {
          localStorage.removeItem('token');
          window.location.href = '/login'; 
          return;
        }
      }
  
      return res;
    } catch (err) {
      console.error("authFetch error:", err);
      throw err;
    }
  };