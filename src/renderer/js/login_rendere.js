const form=document.getElementById('loginForm');
if(form){
    form.addEventListener('submit',(event)=>{
        event.preventDefault();
        const username=document.getElementById('username').value;
        const password=document.getElementById('password').value;
        window.api.login(username,password);
    })
}

const toggleEye=document.getElementById('toggleEye');
if(toggleEye){
    toggleEye.addEventListener('click',()=>{
        const passwordField=document.getElementById('password');
        if(passwordField.type==='password'){
            passwordField.type='text';
            toggleEye.src='../../assets/hide_password.png'; 
        }else{
            passwordField.type='password';
            toggleEye.src='../../assets/view_password.png';
        }
    });
}