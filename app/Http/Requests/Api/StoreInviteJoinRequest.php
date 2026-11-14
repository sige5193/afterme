<?php

namespace App\Http\Requests\Api;

use App\Rules\MaxChars;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInviteJoinRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'message' => ['nullable', 'string', new MaxChars(120)],
            'relation' => ['nullable', Rule::in(array_keys(config('afterme.relations', [])))],
            'group_name' => ['nullable', 'string', new MaxChars(12)],
        ];
    }
}
