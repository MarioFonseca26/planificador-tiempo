<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/setup', function () {
    Illuminate\Support\Facades\Artisan::call('migrate:fresh', ['--force' => true, '--seed' => true]);
    return 'Base de datos creada y poblada exitosamente. Ya puedes volver a la app frontend e iniciar sesión con test@example.com y contraseña: password';
});
