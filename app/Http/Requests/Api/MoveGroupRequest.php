<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class MoveGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'zone_phase_id' => ['required', 'integer', 'exists:zone_phases,id'],
            'start_cell' => ['required', 'integer', 'min:0', 'max:59'],
        ];
    }
}
